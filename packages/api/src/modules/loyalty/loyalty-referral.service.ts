import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LOYALTY_EARN_EVENT_TYPES } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyProgramService } from './loyalty-program.service';

@Injectable()
export class LoyaltyReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
    private readonly programService: LoyaltyProgramService,
  ) {}

  async applyReferral(orgId: string, referralCode: string, referredCustomerId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const program = await this.programService.getOrCreateProgram(orgId);

    const referrer = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findFirst({
        where: { orgId, referralCode: referralCode.toUpperCase() },
        include: { customer: true },
      }),
    );
    if (!referrer) throw new NotFoundException('Referral code not found');
    if (referrer.customerId === referredCustomerId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    const referredAccount = await this.accounts.ensureAccount(orgId, referredCustomerId);
    if (!referredAccount) throw new BadRequestException('Could not create loyalty account');

    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyReferral.findFirst({ where: { referredCustomerId } }),
    );
    if (existing) throw new BadRequestException('Customer already has a referral');

    const referral = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyReferral.create({
        data: {
          orgId,
          referrerAccountId: referrer.id,
          referredCustomerId,
          referredAccountId: referredAccount.id,
          status: 'completed',
          referrerBonusPoints: program.referralBonusPoints,
          referredBonusPoints: program.referredBonusPoints,
          completedAt: new Date(),
        },
      }),
    );

    await this.accounts.earnFromEvent(
      orgId,
      referrer.customerId,
      LOYALTY_EARN_EVENT_TYPES.REFERRAL_COMPLETED,
      { sourceType: 'referral', sourceId: referral.id, description: 'Referral bonus' },
    );
    await this.accounts.earnFromEvent(
      orgId,
      referredCustomerId,
      LOYALTY_EARN_EVENT_TYPES.REFERRAL_COMPLETED,
      { sourceType: 'referral', sourceId: referral.id, description: 'Welcome referral bonus' },
    );

    return referral;
  }

  async listReferrals(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyReferral.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          referrerAccount: { include: { customer: { select: { name: true, email: true } } } },
        },
      }),
    );
  }

  async getReferralStats(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const [total, completed, bonusPoints] = await this.prisma.withTenant(orgId, async (tx) => {
      const all = await tx.loyaltyReferral.count({ where: { orgId } });
      const done = await tx.loyaltyReferral.count({ where: { orgId, status: 'completed' } });
      const agg = await tx.loyaltyReferral.aggregate({
        where: { orgId, status: 'completed' },
        _sum: { referrerBonusPoints: true, referredBonusPoints: true },
      });
      return [all, done, (agg._sum.referrerBonusPoints ?? 0) + (agg._sum.referredBonusPoints ?? 0)];
    });
    return { total, completed, bonusPointsAwarded: bonusPoints };
  }
}
