import { Controller, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { rowsToCsv } from '../../../common/utils/csv-response';
import { LoyaltyDashboardService } from '../loyalty-dashboard.service';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyDashboardController {
  constructor(private readonly dashboard: LoyaltyDashboardService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Loyalty executive dashboard KPIs' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getExecutiveDashboard(user.orgId);
  }

  @Get('reports/points')
  @ApiOperation({ summary: 'Points ledger report by type' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getPointsReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getPointsReport(user.orgId);
  }

  @Get('reports/campaigns')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getCampaignReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getCampaignReport(user.orgId);
  }

  @Get('reports/churn')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getChurnReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getChurnReport(user.orgId);
  }

  @Get('reports/referrals')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getReferralReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getReferralReport(user.orgId);
  }

  @Get('reports/growth')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getGrowthReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getGrowthReport(user.orgId);
  }

  @Get('reports/redemptions')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getRedemptionReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getRedemptionReport(user.orgId);
  }

  @Get('reports/vip')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getVipReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getVipReport(user.orgId);
  }

  @Get('reports/branches')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getBranchReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getBranchPerformanceReport(user.orgId);
  }

  @Get('reports/campaign-roi')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getCampaignRoiReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getCampaignRoiReport(user.orgId);
  }

  @Get('reports/sales-dashboard')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getSalesDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getSalesDashboard(user.orgId);
  }

  @Get('reports/points/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="loyalty-points-report.csv"')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  async exportPointsReport(@CurrentUser() user: AuthenticatedUser) {
    const report = await this.dashboard.getPointsReport(user.orgId);
    return rowsToCsv(
      ['type', 'total_points', 'entry_count'],
      report.byType.map((row) => [row.type, row._sum.points ?? 0, row._count._all]),
    );
  }

  @Get('reports/referrals/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="loyalty-referrals-report.csv"')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  async exportReferralsReport(@CurrentUser() user: AuthenticatedUser) {
    const report = await this.dashboard.getReferralReport(user.orgId);
    return rowsToCsv(
      ['patron_name', 'completed_count'],
      report.topReferrers.map((r) => [r.patronName, r.completedCount]),
    );
  }
}
