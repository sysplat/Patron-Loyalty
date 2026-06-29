import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyDashboardController } from './loyalty-dashboard.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyDashboardController', () => {
  const dashboard = {
    getExecutiveDashboard: vi.fn(),
    getPointsReport: vi.fn(),
    getReferralReport: vi.fn(),
  };
  let controller: LoyaltyDashboardController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyDashboardController(dashboard as never);
  });

  it('delegates executive dashboard to service', async () => {
    dashboard.getExecutiveDashboard.mockResolvedValue({ kpis: {} });
    await expect(controller.getDashboard(USER)).resolves.toEqual({ kpis: {} });
    expect(dashboard.getExecutiveDashboard).toHaveBeenCalledWith(ORG_ID);
  });

  it('delegates points report to service', async () => {
    dashboard.getPointsReport.mockResolvedValue({ byType: [] });
    await controller.getPointsReport(USER);
    expect(dashboard.getPointsReport).toHaveBeenCalledWith(ORG_ID);
  });

  it('exports points report as CSV', async () => {
    dashboard.getPointsReport.mockResolvedValue({
      byType: [{ type: 'EARN', _sum: { points: 100 }, _count: { _all: 5 } }],
    });
    const csv = await controller.exportPointsReport(USER);
    expect(csv).toContain('type');
    expect(csv).toContain('EARN');
  });
});
