import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyDashboardKpisService } from './loyalty-dashboard-kpis.service';

const ORG_ID = 'org-1';

describe('LoyaltyDashboardKpisService', () => {
  const patronCrmFeature = {
    requireEnabled: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyDashboardKpisService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyDashboardKpisService(prisma as never, patronCrmFeature as never);
  });

  it('builds executive dashboard KPIs', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        customer: { count: vi.fn().mockResolvedValue(100) },
        loyaltyAccount: {
          aggregate: vi.fn().mockResolvedValue({
            _count: { _all: 80 },
            _sum: { pointsBalance: 5000, lifetimePointsEarned: 20000, totalVisits: 400 },
            _avg: { healthScore: 72.4 },
          }),
          groupBy: vi.fn().mockResolvedValue([{ tierId: 'tier-1', _count: { _all: 50 } }]),
        },
        loyaltyRedemption: { count: vi.fn().mockResolvedValue(12) },
        loyaltyReferral: { count: vi.fn().mockResolvedValue(5) },
        loyaltyTier: {
          findMany: vi.fn().mockResolvedValue([{ id: 'tier-1', name: 'Gold', slug: 'gold' }]),
        },
        loyaltyPointLedger: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'led-1',
              type: 'earn',
              points: 10,
              description: 'Visit',
              createdAt: new Date('2026-06-01'),
              account: { customer: { name: 'Patron' } },
            },
          ]),
        },
        loyaltyCampaign: { count: vi.fn().mockResolvedValue(2) },
      }),
    );

    const dashboard = await service.getExecutiveDashboard(ORG_ID);

    expect(patronCrmFeature.requireEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(dashboard.kpis).toMatchObject({
      totalPatrons: 100,
      loyaltyMembers: 80,
      pointsOutstanding: 5000,
      completedReferrals: 5,
      activeCampaigns: 2,
      avgHealthScore: 72,
    });
    expect(dashboard.tierDistribution).toHaveLength(1);
    expect(dashboard.recentActivity[0]).toMatchObject({ patronName: 'Patron', points: 10 });
  });

  it('builds sales dashboard metrics', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          aggregate: vi.fn().mockResolvedValue({
            _count: { _all: 50 },
            _sum: { lifetimeValueCents: 100000, lifetimePointsEarned: 5000 },
            _avg: { totalVisits: 3.2 },
          }),
          count: vi.fn().mockResolvedValue(30),
        },
        loyaltyRedemption: { count: vi.fn().mockResolvedValue(10) },
      }),
    );

    const sales = await service.getSalesDashboard(ORG_ID);

    expect(sales).toMatchObject({
      repeatPurchaseRate: 0.6,
      redemptionRate: 0.2,
      avgVisitsPerMember: 3.2,
      totalLifetimeValueCents: 100000,
      totalLifetimePoints: 5000,
    });
  });
});
