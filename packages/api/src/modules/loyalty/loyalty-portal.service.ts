import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyCatalogService } from './loyalty-catalog.service';

@Injectable()
export class LoyaltyPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
    private readonly catalog: LoyaltyCatalogService,
  ) {}

  private async resolveAccountByCode(referralCode: string) {
    const account = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        select: { id: true, orgId: true, customerId: true },
      }),
    );
    if (!account) return null;
    const enabled = await this.patronCrmFeature.isEnabled(account.orgId);
    return enabled ? account : null;
  }

  async getPortalByReferralCode(referralCode: string) {
    const account = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        include: {
          tier: true,
          customer: { select: { name: true, birthday: true } },
          organization: {
            select: {
              name: true,
              slug: true,
              loyaltyProgram: { select: { pointsCurrencyName: true } },
            },
          },
          badges: {
            include: { badge: { select: { id: true, name: true, description: true, icon: true } } },
            orderBy: { earnedAt: 'desc' },
          },
          challengeProgress: {
            include: {
              challenge: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  targetType: true,
                  targetValue: true,
                  rewardPoints: true,
                },
              },
            },
          },
        },
      }),
    );

    if (!account) return { found: false as const };

    const enabled = await this.patronCrmFeature.isEnabled(account.orgId);
    if (!enabled) return { found: false as const };

    const [rewards, ledger] = await this.prisma.withTenant(account.orgId, async (tx) => {
      const rewardRows = await tx.loyaltyReward.findMany({
        where: { orgId: account.orgId, active: true },
        orderBy: { pointsCost: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          pointsCost: true,
          type: true,
          stock: true,
        },
      });
      const ledgerRows = await tx.loyaltyPointLedger.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          type: true,
          points: true,
          description: true,
          createdAt: true,
        },
      });
      return [rewardRows, ledgerRows] as const;
    });

    return {
      found: true as const,
      patronName: account.customer.name,
      birthday: account.customer.birthday,
      orgName: account.organization.name,
      orgSlug: account.organization.slug,
      pointsCurrencyName: account.organization.loyaltyProgram?.pointsCurrencyName ?? 'Points',
      pointsBalance: account.pointsBalance,
      lifetimePointsEarned: account.lifetimePointsEarned,
      tier: account.tier,
      referralCode: account.referralCode,
      totalVisits: account.totalVisits,
      badges: account.badges.map((row) => ({
        id: row.badge.id,
        name: row.badge.name,
        description: row.badge.description,
        icon: row.badge.icon,
        earnedAt: row.earnedAt,
      })),
      challenges: account.challengeProgress.map((row) => ({
        id: row.challenge.id,
        name: row.challenge.name,
        description: row.challenge.description,
        targetType: row.challenge.targetType,
        targetValue: row.challenge.targetValue,
        rewardPoints: row.challenge.rewardPoints,
        progress: row.progress,
        completedAt: row.completedAt,
      })),
      rewards,
      recentActivity: ledger,
    };
  }

  async redeemReward(referralCode: string, rewardId: string) {
    const account = await this.resolveAccountByCode(referralCode);
    if (!account) throw new NotFoundException('Loyalty account not found');

    const redemption = await this.catalog.redeemReward(account.orgId, account.customerId, rewardId);
    return { success: true, redemption };
  }

  async updateProfile(
    referralCode: string,
    data: { birthday?: string | null; gender?: string | null; city?: string | null },
  ) {
    const account = await this.resolveAccountByCode(referralCode);
    if (!account) throw new NotFoundException('Loyalty account not found');

    await this.prisma.withTenant(account.orgId, (tx) =>
      tx.customer.update({
        where: { id: account.customerId },
        data: {
          birthday: data.birthday ? new Date(data.birthday) : data.birthday,
          gender: data.gender,
          city: data.city,
        },
      }),
    );
    return { success: true };
  }
}
