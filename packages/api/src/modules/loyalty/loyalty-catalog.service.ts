import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LOYALTY_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { ApplyPointsTxResult, LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';

type CouponRecord = {
  id: string;
  orgId: string;
  code: string;
  active: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  maxUses: number | null;
  usedCount: number;
  tierSlugs: unknown;
};

type AccountWithTier = {
  tier: { slug: string } | null;
};

@Injectable()
export class LoyaltyCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
  ) {}

  private async requireLoyalty(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
  }

  private assertCouponValid(coupon: CouponRecord, account?: AccountWithTier | null) {
    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException('Coupon is not yet valid');
    }
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    const tierSlugs = (coupon.tierSlugs as string[]) ?? [];
    if (tierSlugs.length > 0 && account?.tier && !tierSlugs.includes(account.tier.slug)) {
      throw new BadRequestException('Coupon not valid for patron tier');
    }
  }

  async listRewards(orgId: string, activeOnly = true) {
    await this.requireLoyalty(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyReward.findMany({
        where: activeOnly ? { active: true } : undefined,
        orderBy: { pointsCost: 'asc' },
      }),
    );
  }

  async createReward(
    orgId: string,
    data: {
      name: string;
      description?: string | null;
      type: string;
      pointsCost: number;
      stock?: number | null;
      active?: boolean;
      validFrom?: Date | null;
      validUntil?: Date | null;
      imageUrl?: string | null;
    },
  ) {
    await this.requireLoyalty(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyReward.create({ data: { orgId, ...data } }),
    );
  }

  async updateReward(orgId: string, id: string, data: object) {
    await this.requireLoyalty(orgId);
    return this.prisma.withTenant(orgId, (tx) => tx.loyaltyReward.update({ where: { id }, data }));
  }

  async redeemReward(orgId: string, customerId: string, rewardId: string) {
    await this.requireLoyalty(orgId);
    const account = await this.accounts.getAccountByCustomerId(orgId, customerId);

    const { redemption, burnResult } = await this.prisma.withTenant(orgId, async (tx) => {
      const reward = await tx.loyaltyReward.findFirst({
        where: { id: rewardId, orgId, active: true },
      });
      if (!reward) throw new NotFoundException('Reward not found');

      const now = new Date();
      if (reward.validFrom && reward.validFrom > now) {
        throw new BadRequestException('Reward is not yet available');
      }
      if (reward.validUntil && reward.validUntil < now) {
        throw new BadRequestException('Reward has expired');
      }

      const burnResult = (await this.accounts.burnPoints(
        orgId,
        account.id,
        reward.pointsCost,
        {
          sourceType: 'reward',
          sourceId: rewardId,
          description: `Redeemed: ${reward.name}`,
        },
        tx,
      )) as ApplyPointsTxResult;

      if (reward.stock !== null) {
        const stockDec = await tx.loyaltyReward.updateMany({
          where: { id: rewardId, orgId, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (stockDec.count === 0) {
          throw new BadRequestException('Reward is out of stock');
        }
      }

      const redemption = await tx.loyaltyRedemption.create({
        data: {
          orgId,
          accountId: account.id,
          rewardId,
          pointsSpent: reward.pointsCost,
          status: 'pending',
        },
        include: { reward: true },
      });

      return { redemption, burnResult };
    });

    if (!burnResult.idempotent) {
      this.accounts.dispatchApplyPointsSideEffects(orgId, account.id, burnResult, {
        sourceType: 'reward',
        sourceId: rewardId,
      });
    }

    void this.loyaltyWebhook.dispatch(orgId, LOYALTY_WEBHOOK_EVENTS.REWARD_REDEEMED, {
      customerId,
      accountId: account.id,
      rewardId,
      redemptionId: redemption.id,
      pointsSpent: redemption.pointsSpent,
    });

    return redemption;
  }

  async listCoupons(orgId: string) {
    await this.requireLoyalty(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCoupon.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  async createCoupon(orgId: string, data: Record<string, unknown>) {
    await this.requireLoyalty(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCoupon.create({ data: { orgId, ...data } as never }),
    );
  }

  async validateCoupon(orgId: string, code: string, accountId?: string) {
    await this.requireLoyalty(orgId);
    const coupon = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCoupon.findFirst({ where: { orgId, code: code.toUpperCase(), active: true } }),
    );
    if (!coupon) throw new NotFoundException('Coupon not found');

    let account: AccountWithTier | null = null;
    if (accountId) {
      account = await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyAccount.findFirst({ where: { id: accountId, orgId }, include: { tier: true } }),
      );
    }

    this.assertCouponValid(coupon, account);
    return { valid: true, coupon };
  }

  async redeemCoupon(orgId: string, code: string, accountId: string) {
    await this.requireLoyalty(orgId);
    return this.prisma.withTenant(orgId, async (tx) => {
      const coupon = await tx.loyaltyCoupon.findFirst({
        where: { orgId, code: code.toUpperCase(), active: true },
      });
      if (!coupon) throw new NotFoundException('Coupon not found');

      const account = await tx.loyaltyAccount.findFirst({
        where: { id: accountId, orgId },
        include: { tier: true },
      });
      if (!account) throw new NotFoundException('Loyalty account not found');

      this.assertCouponValid(coupon, account);

      const reserved = await tx.loyaltyCoupon.updateMany({
        where: {
          id: coupon.id,
          orgId,
          active: true,
          ...(coupon.maxUses !== null ? { usedCount: { lt: coupon.maxUses } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (reserved.count === 0) {
        throw new BadRequestException('Coupon usage limit reached');
      }

      return tx.loyaltyCouponRedemption.create({
        data: { orgId, couponId: coupon.id, accountId },
        include: { coupon: true },
      });
    });
  }

  async deleteReward(orgId: string, id: string) {
    await this.requireLoyalty(orgId);
    await this.prisma.withTenant(orgId, (tx) => tx.loyaltyReward.delete({ where: { id } }));
  }

  async deleteCoupon(orgId: string, id: string) {
    await this.requireLoyalty(orgId);
    await this.prisma.withTenant(orgId, (tx) => tx.loyaltyCoupon.delete({ where: { id } }));
  }
}
