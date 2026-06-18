import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { WorkbenchService } from './workbench.service';
import { WorkbenchActionService } from './workbench-action.service';
import {
  WorkbenchCallNextDto,
  WorkbenchCallSpecificDto,
  WorkbenchCancelDto,
  WorkbenchCompleteDto,
  WorkbenchSessionDto,
  WorkbenchTicketActionDto,
} from './dto/workbench.dto';

@ApiTags('Workbench')
@ApiBearerAuth()
@Controller({ path: 'workbench', version: '1' })
export class WorkbenchController {
  constructor(
    private readonly workbenchService: WorkbenchService,
    private readonly workbenchActionService: WorkbenchActionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Aggregated multi-queue work surface for station profile' })
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({
    name: 'stationProfileId',
    required: false,
    description:
      'Omit to use default profile for branch (auto-generated from active flow if needed)',
  })
  @ApiQuery({ name: 'deskId', required: false })
  @ApiQuery({ name: 'deskNumber', required: false })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week'] })
  @ApiQuery({
    name: 'forJourney',
    required: false,
    description: 'Use combined station profile for multi-step journey UI',
  })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  async getWorkbench(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Query('branchId') branchId: string,
    @Query('stationProfileId') stationProfileId?: string,
    @Query('deskId') deskId?: string,
    @Query('deskNumber') deskNumber?: string,
    @Query('period') period?: 'today' | 'week',
    @Query('forJourney') forJourney?: string,
    @Query('queueId') queueId?: string,
  ) {
    const userId = user.userId ?? user.id;
    if (!userId) throw new Error('User id required');
    const data = await this.workbenchService.getWorkbench(user.orgId, userId, {
      branchId,
      ...(stationProfileId ? { stationProfileId } : {}),
      deskId,
      deskNumber,
      period,
      forJourney: forJourney === 'true' || forJourney === '1',
      queueId,
    });
    return { success: true, data };
  }

  @Get('branch-needs-workbench')
  @ApiOperation({ summary: 'Whether branch should use workbench instead of single-queue agent' })
  @ApiQuery({ name: 'branchId', required: true })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  async branchNeedsWorkbench(
    @CurrentUser() user: { orgId: string },
    @Query('branchId') branchId: string,
  ) {
    const needs = await this.workbenchService.branchNeedsWorkbench(user.orgId, branchId);
    return { success: true, data: { needsWorkbench: needs } };
  }

  @Get('branch-serve-context')
  @ApiOperation({ summary: 'Branch journey summary for Serve customers UI' })
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'queueId', required: false })
  @ApiQuery({ name: 'deskNumber', required: false })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  async branchServeContext(
    @CurrentUser() user: { orgId: string },
    @Query('branchId') branchId: string,
    @Query('queueId') queueId?: string,
    @Query('deskNumber') deskNumber?: string,
  ) {
    const data = await this.workbenchService.getBranchServeContext(
      user.orgId,
      branchId,
      queueId,
      deskNumber,
    );
    return { success: true, data };
  }

  @Post('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Establish or update journey workbench session at a desk (before serve actions)',
  })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async establishSession(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchSessionDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchService.establishJourneySession(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Get('serve-branches')
  @ApiOperation({ summary: 'Branches with queues for a serve surface (classic vs journey)' })
  @ApiQuery({ name: 'surface', required: true, enum: ['classic', 'journey'] })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  async serveBranches(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Query('surface') surface: 'classic' | 'journey',
  ) {
    const userId = user.userId ?? user.id;
    if (!userId) throw new Error('User id required');
    const normalized = surface === 'journey' ? 'journey' : 'classic';
    const data = await this.workbenchService.listServeBranchesForPrincipal(
      user.orgId,
      userId,
      normalized,
    );
    return { success: true, data };
  }

  @Post('actions/call-next')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workbench call next with station capability enforcement' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async callNext(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchCallNextDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.callNext(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Post('actions/call-specific')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workbench call specific ticket with station capability enforcement' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async callSpecific(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchCallSpecificDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.callSpecific(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Post('actions/prioritize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workbench prioritize ticket with station capability enforcement' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async prioritize(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchTicketActionDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.prioritize(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Post('actions/serve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workbench serve ticket with station capability enforcement' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async serve(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchTicketActionDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.serve(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Post('actions/recall')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Workbench recall (re-call or undo start serving → called) with station capability enforcement',
  })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async recall(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchTicketActionDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.recall(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Post('actions/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workbench complete ticket with station capability enforcement' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async complete(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchCompleteDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.complete(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Post('actions/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workbench no-show ticket with station capability enforcement' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async noShow(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchTicketActionDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.noShow(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Post('actions/mark-ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workbench mark-ready with station capability enforcement' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async markReady(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchTicketActionDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.markReady(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Post('actions/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Workbench cancel ticket with station capability enforcement' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async cancel(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: WorkbenchCancelDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.workbenchActionService.cancel(user.orgId, userId!, body);
    return { success: true, data };
  }
}
