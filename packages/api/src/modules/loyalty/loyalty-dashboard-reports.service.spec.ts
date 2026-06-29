import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyDashboardReportsService } from './loyalty-dashboard-reports.service';

const ORG_ID = 'org-1';

describe('LoyaltyDashboardReportsService', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyDashboardReportsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyDashboardReportsService(prisma as never, patronCrmFeature as never);
  });

  it('returns points report grouped by ledger type', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyPointLedger: {
          groupBy: vi
            .fn()
            .mockResolvedValue([{ type: 'earn', _sum: { points: 100 }, _count: { _all: 5 } }]),
        },
      }),
    );

    const report = await service.getPointsReport(ORG_ID);
    expect(report.byType).toHaveLength(1);
  });

  it('returns churn risk distribution', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          groupBy: vi
            .fn()
            .mockResolvedValue([
              { churnRisk: 'low', _count: { _all: 10 }, _avg: { healthScore: 80 } },
            ]),
        },
      }),
    );

    const report = await service.getChurnReport(ORG_ID);
    expect(report.distribution).toHaveLength(1);
  });

  it('returns campaign report with send status counts', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaign: {
          findMany: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Promo', status: 'active' }]),
        },
        loyaltyCampaignSend: {
          groupBy: vi.fn().mockResolvedValue([{ status: 'sent', _count: { _all: 3 } }]),
        },
      }),
    );

    const report = await service.getCampaignReport(ORG_ID);
    expect(report.campaigns).toHaveLength(1);
    expect(report.sendsByStatus).toHaveLength(1);
  });

  it('returns referral report with top referrers', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyReferral: {
          aggregate: vi.fn().mockResolvedValue({
            _count: { _all: 5 },
            _sum: { referrerBonusPoints: 100, referredBonusPoints: 50 },
          }),
          groupBy: vi
            .fn()
            .mockResolvedValue([{ referrerAccountId: 'acct-ref', _count: { _all: 3 } }]),
        },
        loyaltyAccount: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'acct-ref',
              referralCode: 'REF99',
              customer: { name: 'Alice' },
            },
          ]),
        },
      }),
    );

    const report = await service.getReferralReport(ORG_ID);
    expect(report.completed).toBe(5);
    expect(report.topReferrers[0]).toMatchObject({ patronName: 'Alice', completedCount: 3 });
  });

  it('returns growth report from monthly patron signups', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: vi.fn().mockResolvedValue([{ month: '2026-06', count: BigInt(12) }]),
      }),
    );

    const report = await service.getGrowthReport(ORG_ID);
    expect(report.monthlyNewPatrons).toEqual([{ month: '2026-06', count: 12 }]);
  });

  it('returns redemption report by status and reward', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyRedemption: {
          groupBy: vi
            .fn()
            .mockResolvedValueOnce([{ status: 'fulfilled', _count: { _all: 4 } }])
            .mockResolvedValueOnce([{ rewardId: 'r1', _count: { _all: 4 } }]),
        },
        loyaltyReward: {
          findMany: vi.fn().mockResolvedValue([{ id: 'r1', name: 'Coffee', pointsCost: 100 }]),
        },
      }),
    );

    const report = await service.getRedemptionReport(ORG_ID);
    expect(report.byStatus).toHaveLength(1);
    expect(report.byReward[0]).toMatchObject({ rewardId: 'r1', count: 4 });
  });

  it('returns VIP report with top patrons', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          count: vi.fn().mockResolvedValue(2),
          findMany: vi.fn().mockResolvedValue([
            {
              customerId: 'cust-vip',
              lifetimePointsEarned: 8000,
              lifetimeValueCents: 50000,
              customer: { name: 'VIP Patron', email: 'vip@example.com' },
              tier: { name: 'Gold', slug: 'gold' },
            },
          ]),
        },
      }),
    );

    const report = await service.getVipReport(ORG_ID);
    expect(report.vipCount).toBe(2);
    expect(report.topPatrons[0].patronName).toBe('VIP Patron');
  });

  it('returns branch performance from ticket visits', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: vi
          .fn()
          .mockResolvedValue([
            { branch_id: 'b1', branch_name: 'Downtown', visit_count: BigInt(42) },
          ]),
      }),
    );

    const report = await service.getBranchPerformanceReport(ORG_ID);
    expect(report.branches[0]).toEqual({
      branchId: 'b1',
      branchName: 'Downtown',
      visitCount: 42,
    });
  });

  it('returns campaign ROI breakdown per campaign', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaign: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              {
                id: 'c1',
                name: 'Promo',
                channel: 'sms',
                trigger: 'manual',
                sentCount: 10,
                status: 'active',
              },
            ]),
        },
        loyaltyCampaignSend: {
          groupBy: vi.fn().mockResolvedValue([
            { campaignId: 'c1', status: 'sent', _count: { _all: 8 } },
            { campaignId: 'c1', status: 'failed', _count: { _all: 2 } },
          ]),
        },
      }),
    );

    const report = await service.getCampaignRoiReport(ORG_ID);
    expect(report.campaigns[0].sendBreakdown).toHaveLength(2);
    expect(report.campaigns[0].estimatedRoiNote).toContain('ROI');
  });
});
