import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';

@Injectable()
export class LoyaltyDashboardService {
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

  async getPointsReport(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const byType = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPointLedger.groupBy({
        by: ['type'],
        where: { orgId },
        _sum: { points: true },
        _count: { _all: true },
      }),
    );
    return { byType };
  }

  async getCampaignReport(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, async (tx) => {
      const campaigns = await tx.loyaltyCampaign.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          trigger: true,
          channel: true,
          status: true,
          sentCount: true,
        },
      });
      const sends = await tx.loyaltyCampaignSend.groupBy({
        by: ['status'],
        where: { orgId },
        _count: { _all: true },
      });
      return { campaigns, sendsByStatus: sends };
    });
  }

  async getChurnReport(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const distribution = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.groupBy({
        by: ['churnRisk'],
        where: { orgId },
        _count: { _all: true },
        _avg: { healthScore: true },
      }),
    );
    return { distribution };
  }

  async getReferralReport(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, async (tx) => {
      const stats = await tx.loyaltyReferral.aggregate({
        where: { orgId, status: 'completed' },
        _count: { _all: true },
        _sum: { referrerBonusPoints: true, referredBonusPoints: true },
      });
      const topReferrers = await tx.loyaltyReferral.groupBy({
        by: ['referrerAccountId'],
        where: { orgId, status: 'completed' },
        _count: { _all: true },
        orderBy: { _count: { referrerAccountId: 'desc' } },
        take: 10,
      });
      const accountIds = topReferrers.map((r) => r.referrerAccountId);
      const accounts = accountIds.length
        ? await tx.loyaltyAccount.findMany({
            where: { id: { in: accountIds } },
            include: { customer: { select: { name: true } } },
          })
        : [];
      return {
        completed: stats._count._all,
        bonusPointsAwarded:
          (stats._sum.referrerBonusPoints ?? 0) + (stats._sum.referredBonusPoints ?? 0),
        topReferrers: topReferrers.map((row) => {
          const account = accounts.find((a) => a.id === row.referrerAccountId);
          return {
            referrerAccountId: row.referrerAccountId,
            patronName: account?.customer.name ?? 'Unknown',
            referralCode: account?.referralCode ?? null,
            completedCount: row._count._all,
          };
        }),
      };
    });
  }

  async getGrowthReport(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.$queryRaw<Array<{ month: string; count: bigint }>>(Prisma.sql`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::bigint AS count
        FROM customers
        WHERE org_id = ${orgId}::uuid
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY 1
        ORDER BY 1 ASC
      `),
    );
    return {
      monthlyNewPatrons: rows.map((r) => ({ month: r.month, count: Number(r.count) })),
    };
  }

  async getRedemptionReport(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, async (tx) => {
      const byStatus = await tx.loyaltyRedemption.groupBy({
        by: ['status'],
        where: { orgId },
        _count: { _all: true },
      });
      const byReward = await tx.loyaltyRedemption.groupBy({
        by: ['rewardId'],
        where: { orgId },
        _count: { _all: true },
        orderBy: { _count: { rewardId: 'desc' } },
        take: 15,
      });
      const rewardIds = byReward.map((r) => r.rewardId);
      const rewards = rewardIds.length
        ? await tx.loyaltyReward.findMany({
            where: { id: { in: rewardIds } },
            select: { id: true, name: true, pointsCost: true },
          })
        : [];
      return {
        byStatus,
        byReward: byReward.map((row) => ({
          rewardId: row.rewardId,
          count: row._count._all,
          reward: rewards.find((r) => r.id === row.rewardId) ?? null,
        })),
      };
    });
  }

  async getVipReport(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, async (tx) => {
      const vipWhere = {
        orgId,
        OR: [
          { tier: { slug: { in: ['gold', 'platinum', 'diamond'] } } },
          { lifetimePointsEarned: { gte: 5000 } },
        ],
      };
      const count = await tx.loyaltyAccount.count({ where: vipWhere });
      const top = await tx.loyaltyAccount.findMany({
        where: vipWhere,
        orderBy: { lifetimePointsEarned: 'desc' },
        take: 15,
        include: {
          customer: { select: { name: true, email: true } },
          tier: { select: { name: true, slug: true } },
        },
      });
      return {
        vipCount: count,
        topPatrons: top.map((a) => ({
          customerId: a.customerId,
          patronName: a.customer.name,
          email: a.customer.email,
          tier: a.tier,
          lifetimePointsEarned: a.lifetimePointsEarned,
          lifetimeValueCents: a.lifetimeValueCents,
        })),
      };
    });
  }
}
