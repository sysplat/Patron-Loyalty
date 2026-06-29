import { Injectable } from '@nestjs/common';
import { LoyaltyDashboardKpisService } from './loyalty-dashboard-kpis.service';
import { LoyaltyDashboardReportsService } from './loyalty-dashboard-reports.service';

@Injectable()
export class LoyaltyDashboardService {
  constructor(
    private readonly kpis: LoyaltyDashboardKpisService,
    private readonly reports: LoyaltyDashboardReportsService,
  ) {}

  getExecutiveDashboard(orgId: string) {
    return this.kpis.getExecutiveDashboard(orgId);
  }

  getSalesDashboard(orgId: string) {
    return this.kpis.getSalesDashboard(orgId);
  }

  getPointsReport(orgId: string) {
    return this.reports.getPointsReport(orgId);
  }

  getCampaignReport(orgId: string) {
    return this.reports.getCampaignReport(orgId);
  }

  getChurnReport(orgId: string) {
    return this.reports.getChurnReport(orgId);
  }

  getReferralReport(orgId: string) {
    return this.reports.getReferralReport(orgId);
  }

  getGrowthReport(orgId: string) {
    return this.reports.getGrowthReport(orgId);
  }

  getRedemptionReport(orgId: string) {
    return this.reports.getRedemptionReport(orgId);
  }

  getVipReport(orgId: string) {
    return this.reports.getVipReport(orgId);
  }

  getBranchPerformanceReport(orgId: string) {
    return this.reports.getBranchPerformanceReport(orgId);
  }

  getCampaignRoiReport(orgId: string) {
    return this.reports.getCampaignRoiReport(orgId);
  }
}
