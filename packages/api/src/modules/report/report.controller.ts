import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { PlanLimitService } from '../billing/plan-limit.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly planLimitService: PlanLimitService,
  ) {}

  @Get('overview')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Dashboard overview statistics' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week'] })
  @RequirePermissions({ resource: 'report', action: 'read' })
  async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('period') period?: 'today' | 'week',
  ) {
    const data = await this.reportService.overviewForPrincipal(
      user.orgId,
      user.userId,
      branchId,
      period,
    );
    return { success: true, data };
  }

  @Get('tickets-by-hour')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Tickets distribution by hour for a day' })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'report', action: 'read' })
  async ticketsByHour(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date: string,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.reportService.ticketsByHourForPrincipal(
      user.orgId,
      user.userId,
      date,
      branchId,
    );
    return { success: true, data };
  }

  @Get('service-performance')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Service performance report' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'report', action: 'read' })
  async servicePerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    await this.planLimitService.requireFeature(
      user.orgId,
      'hasAdvancedReports',
      'Advanced reports are available on the Enterprise plan.',
    );
    const data = await this.reportService.servicePerformanceForPrincipal(
      user.orgId,
      user.userId,
      from,
      to,
      branchId,
    );
    return { success: true, data };
  }

  @Get('staff-performance')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Staff performance report' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'report', action: 'read' })
  async staffPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    await this.planLimitService.requireFeature(
      user.orgId,
      'hasAdvancedReports',
      'Advanced reports are available on the Enterprise plan.',
    );
    const data = await this.reportService.staffPerformanceForPrincipal(
      user.orgId,
      user.userId,
      from,
      to,
      branchId,
    );
    return { success: true, data };
  }

  @Get('daily-summary')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Daily summary report' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'report', action: 'read' })
  async dailySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    await this.planLimitService.requireFeature(
      user.orgId,
      'hasAdvancedReports',
      'Advanced reports are available on the Enterprise plan.',
    );
    const data = await this.reportService.dailySummaryForPrincipal(
      user.orgId,
      user.userId,
      from,
      to,
      branchId,
    );
    return { success: true, data };
  }

  @Get('visit-journey')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Visit-level journey report (single-step + multi-step customer flows)' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'report', action: 'read' })
  async visitJourney(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    await this.planLimitService.requireFeature(
      user.orgId,
      'hasAdvancedReports',
      'Advanced reports are available on the Enterprise plan.',
    );
    const data = await this.reportService.visitJourneyForPrincipal(
      user.orgId,
      user.userId,
      from,
      to,
      branchId,
    );
    return { success: true, data };
  }

  @Get('traffic-heatmap')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Traffic heatmap (day × hour matrix)' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'report', action: 'read' })
  async trafficHeatmap(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    await this.planLimitService.requireFeature(
      user.orgId,
      'hasAdvancedReports',
      'Advanced reports are available on the Enterprise plan.',
    );
    const data = await this.reportService.trafficHeatmapForPrincipal(
      user.orgId,
      user.userId,
      from,
      to,
      branchId,
    );
    return { success: true, data };
  }

  @Get('branch-comparison')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Branch-by-branch comparison report' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @RequirePermissions({ resource: 'report', action: 'read' })
  async branchComparison(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    await this.planLimitService.requireFeature(
      user.orgId,
      'hasAdvancedReports',
      'Advanced reports are available on the Enterprise plan.',
    );
    const data = await this.reportService.branchComparisonForPrincipal(
      user.orgId,
      user.userId,
      from,
      to,
    );
    return { success: true, data };
  }
}
