import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyDashboardService } from './loyalty-dashboard.service';

const ORG_ID = 'org-1';

describe('LoyaltyDashboardService', () => {
  const kpis = { getExecutiveDashboard: vi.fn(), getSalesDashboard: vi.fn() };
  const reports = {
    getPointsReport: vi.fn(),
    getCampaignReport: vi.fn(),
    getChurnReport: vi.fn(),
    getReferralReport: vi.fn(),
    getGrowthReport: vi.fn(),
    getRedemptionReport: vi.fn(),
    getVipReport: vi.fn(),
    getBranchPerformanceReport: vi.fn(),
    getCampaignRoiReport: vi.fn(),
  };
  let service: LoyaltyDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyDashboardService(kpis as never, reports as never);
  });

  it('delegates executive dashboard to KPIs service', async () => {
    kpis.getExecutiveDashboard.mockResolvedValue({ kpis: {} });
    await service.getExecutiveDashboard(ORG_ID);
    expect(kpis.getExecutiveDashboard).toHaveBeenCalledWith(ORG_ID);
  });

  it('delegates report methods to reports service', async () => {
    reports.getPointsReport.mockResolvedValue({ byType: [] });
    reports.getCampaignRoiReport.mockResolvedValue({ roi: 1.2 });
    await service.getPointsReport(ORG_ID);
    await service.getCampaignRoiReport(ORG_ID);
    expect(reports.getPointsReport).toHaveBeenCalledWith(ORG_ID);
    expect(reports.getCampaignRoiReport).toHaveBeenCalledWith(ORG_ID);
  });
});
