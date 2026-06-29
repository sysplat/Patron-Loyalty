import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';

@Injectable()
export class LoyaltyDashboardKpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  async getExecutiveDashboard(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);

    const [
      patronCount,
      accountStats,
      redemptionCount,
      referralStats,
      tierDistribution,
      recentLedger,
      campaignStats,
    ] = await this.prisma.withTenant(orgId, async (tx) => {
      const patrons = await tx.customer.count({ where: { orgId } });
      const accounts = await tx.loyaltyAccount.aggregate({
        where: { orgId },
        _count: { _all: true },
        _sum: { pointsBalance: true, lifetimePointsEarned: true, totalVisits: true },
        _avg: { healthScore: true },
      });
      const redemptions = await tx.loyaltyRedemption.count({ where: { orgId } });
      const referrals = await tx.loyaltyReferral.count({ where: { orgId, status: 'completed' } });
      const tiers = await tx.loyaltyAccount.groupBy({
        by: ['tierId'],
        where: { orgId },
        _count: { _all: true },
      });
      const tierNames = await tx.loyaltyTier.findMany({
        where: { orgId },
        select: { id: true, name: true, slug: true },
      });
      const ledger = await tx.loyaltyPointLedger.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { account: { include: { customer: { select: { name: true } } } } },
      });
      const campaigns = await tx.loyaltyCampaign.count({ where: { orgId, status: 'active' } });
      return [patrons, accounts, redemptions, referrals, { tiers, tierNames }, ledger, campaigns];
    });

    const redemptionRate =
      accountStats._sum.lifetimePointsEarned && accountStats._sum.lifetimePointsEarned > 0
        ? Math.round((redemptionCount / accountStats._count._all) * 100) / 100
        : 0;

    return {
      kpis: {
        totalPatrons: patronCount,
        loyaltyMembers: accountStats._count._all,
        pointsOutstanding: accountStats._sum.pointsBalance ?? 0,
        lifetimePointsEarned: accountStats._sum.lifetimePointsEarned ?? 0,
        totalVisits: accountStats._sum.totalVisits ?? 0,
        avgHealthScore: Math.round(accountStats._avg.healthScore ?? 50),
        redemptionCount,
        redemptionRate,
        completedReferrals: referralStats,
        activeCampaigns: campaignStats,
      },
      tierDistribution: tierDistribution.tiers.map((row) => ({
        tierId: row.tierId,
        count: row._count._all,
        tier: tierDistribution.tierNames.find((t) => t.id === row.tierId) ?? null,
      })),
      recentActivity: recentLedger.map((entry) => ({
        id: entry.id,
        type: entry.type,
        points: entry.points,
        description: entry.description,
        patronName: entry.account.customer.name,
        createdAt: entry.createdAt,
      })),
    };
  }

  async getSalesDashboard(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const [accounts, repeatBuyers, redemptions] = await this.prisma.withTenant(
      orgId,
      async (tx) => {
        const acc = await tx.loyaltyAccount.aggregate({
          where: { orgId },
          _count: { _all: true },
          _sum: { lifetimeValueCents: true, lifetimePointsEarned: true },
          _avg: { totalVisits: true },
        });
        const repeat = await tx.loyaltyAccount.count({
          where: { orgId, totalVisits: { gte: 2 } },
        });
        const red = await tx.loyaltyRedemption.count({ where: { orgId } });
        return [acc, repeat, red] as const;
      },
    );
    const members = accounts._count._all || 1;
    return {
      repeatPurchaseRate: Math.round((repeatBuyers / members) * 100) / 100,
      redemptionRate: Math.round((redemptions / members) * 100) / 100,
      avgVisitsPerMember: Math.round((accounts._avg.totalVisits ?? 0) * 10) / 10,
      totalLifetimeValueCents: accounts._sum.lifetimeValueCents ?? 0,
      totalLifetimePoints: accounts._sum.lifetimePointsEarned ?? 0,
    };
  }
}
