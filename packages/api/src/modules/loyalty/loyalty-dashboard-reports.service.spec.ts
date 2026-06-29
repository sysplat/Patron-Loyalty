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
});
