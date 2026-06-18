import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { TicketService } from './ticket.service';
import { TicketTrackSseService } from './ticket-track-sse.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { DisplayAuthGuard } from '../../common/guards/display-auth.guard';
import { OrgOwnerGuard } from '../../common/guards/org-owner.guard';
import { OrgOwnerOrAdminGuard } from '../../common/guards/org-owner-or-admin.guard';
import {
  AnonymizeCustomerDto,
  CallNextTicketDto,
  CallWaitingTicketDto,
  CancelTicketDto,
  ChangeDeskTicketDto,
  CompleteTicketBodyDto,
  DeleteHistoryBulkDto,
  IssueTicketDto,
  IssueTicketStaffDto,
  TicketIdBodyDto,
  TransferTicketBodyDto,
  UpdateTicketEstimatesDto,
  UpdateTicketPreferencesDto,
} from './dto/ticket.dto';
import { ListTicketsQueryDto } from './dto/ticket-query.dto';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly ticketTrackSse: TicketTrackSseService,
  ) {}

  private static resolvePublicThrottle(defaultLimit: number, envKey: string) {
    const isProd = process.env.NODE_ENV === 'production';
    const raw = Number.parseInt(process.env[envKey] ?? '', 10);
    const limit = !isProd && Number.isFinite(raw) && raw > 0 ? raw : defaultLimit;
    return { medium: { limit, ttl: 60_000 } };
  }

  private static readonly PUBLIC_LOOKUP_THROTTLE = TicketController.resolvePublicThrottle(
    30,
    'LOAD_TEST_PUBLIC_LOOKUP_LIMIT',
  );
  private static readonly PUBLIC_ISSUE_THROTTLE = TicketController.resolvePublicThrottle(
    60,
    'LOAD_TEST_PUBLIC_ISSUE_LIMIT',
  );
  private static readonly PUBLIC_STREAM_THROTTLE = TicketController.resolvePublicThrottle(
    20,
    'LOAD_TEST_PUBLIC_STREAM_LIMIT',
  );

  @Get()
  @AllowBranchScopedListRead()
  @ApiOperation({
    summary:
      'List tickets (paginated history; permanent removal is owner-only via DELETE /tickets/:id)',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'queueId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Single status, comma-separated list, or all',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description:
      'ISO yyyy-mm-dd — single calendar day in the organization timezone (mutually exclusive with dateFrom/dateTo)',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description:
      'ISO yyyy-mm-dd — start of history range in organization timezone (requires dateTo)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description:
      'ISO yyyy-mm-dd — end of history range inclusive in organization timezone (requires dateFrom)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive match on display #, customer name, or phone',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTicketsQueryDto) {
    const result = await this.ticketService.listForPrincipal(user.orgId, user.userId, query);
    return { success: true as const, ...result };
  }

  @Get('operations/live')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Get today live operations board across branches, queues, and desks' })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  getLiveOperations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('period') period?: 'today' | 'week',
  ) {
    return this.ticketService.getLiveOperationsForPrincipal(user.orgId, user.userId, {
      branchId,
      period,
    });
  }

  @Get('consent/audit')
  @ApiOperation({
    summary:
      'List org-scoped SMS consent audit events captured from booking, kiosk, and tracking flows',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  listSmsConsentAudit(
    @CurrentUser() user: { orgId: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? Number.parseInt(page, 10) : undefined;
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.ticketService.listSmsConsentAudit(user.orgId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  /** Static paths must be declared before @Get(':id') or Nest matches e.g. `branch` as an id. */

  /** Secured display board — requires a valid X-Display-Token (issued during OTP pairing). */
  @Get('display/board')
  @Public()
  @UseGuards(DisplayAuthGuard)
  @ApiOperation({
    summary: 'Token-secured lobby/TV board — display-device authenticated (no PII)',
  })
  @ApiHeader({
    name: 'X-Display-Token',
    description: 'Short-lived JWT session token from pairing',
    required: true,
  })
  getSecureDisplayBoard(@Req() req: Request & { displayDevice?: any }) {
    return this.ticketService.getPublicDisplayBoard(req.displayDevice.branchId);
  }

  @Get('branch/:branchId/display/:displayNumber')
  @Public()
  @Throttle(TicketController.PUBLIC_LOOKUP_THROTTLE)
  @ApiOperation({ summary: 'Get ticket by display number (public, for kiosks/customers)' })
  getByDisplayNumber(
    @Param('branchId') branchId: string,
    @Param('displayNumber') displayNumber: string,
    @Query('orgId') orgId: string,
  ) {
    return this.ticketService.getByDisplayNumber(orgId, branchId, displayNumber);
  }

  @Get('queue/:queueId/stats')
  @ApiOperation({ summary: 'Get queue ticket statistics' })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week'] })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  getQueueStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('queueId') queueId: string,
    @Query('period') period?: 'today' | 'week',
  ) {
    return this.ticketService.getQueueStats(user.orgId, queueId, period);
  }

  @Get('queue/:queueId/live-slice')
  @ApiOperation({
    summary: 'Live queue tickets and counts for agent console (single request)',
  })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week'] })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  async getQueueLiveSlice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('queueId') queueId: string,
    @Query('period') period?: 'today' | 'week',
  ) {
    const data = await this.ticketService.getQueueLiveSliceForPrincipal(
      user.orgId,
      user.userId,
      queueId,
      period ?? 'today',
    );
    return { success: true as const, data };
  }

  @Post('ops/close-prior-session-waiting')
  @UseGuards(OrgOwnerOrAdminGuard)
  @ApiOperation({
    summary:
      'Cancel waiting tickets from prior branch-local queue sessions (before today midnight)',
  })
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async closePriorSessionWaiting(
    @CurrentUser() user: { orgId: string },
    @Query('dryRun') dryRun?: string,
    @Query('branchId') branchId?: string,
  ) {
    const result = await this.ticketService.closePriorSessionWaitingTickets({
      orgId: user.orgId,
      branchId: branchId?.trim() || undefined,
      dryRun: dryRun === 'true' || dryRun === '1',
    });
    return { success: true as const, data: result };
  }

  @Get('queue/:queueId/agent-performance')
  @ApiOperation({ summary: "Get current agent's performance stats for a queue" })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week'] })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  getAgentPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('queueId') queueId: string,
    @Query('period') period?: 'today' | 'week',
  ) {
    return this.ticketService.getAgentPerformance(user.orgId, queueId, user.userId, period);
  }

  @Get('branch/:branchId/agent-performance')
  @ApiOperation({ summary: "Get current agent's performance stats for a branch" })
  @ApiQuery({ name: 'period', required: false, enum: ['today', 'week'] })
  @ApiQuery({ name: 'forJourney', required: false, type: Boolean })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  getBranchAgentPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('branchId') branchId: string,
    @Query('period') period?: 'today' | 'week',
    @Query('forJourney') forJourney?: string,
  ) {
    const isJourney = forJourney === 'true' ? true : forJourney === 'false' ? false : undefined;
    return this.ticketService.getBranchAgentPerformance(
      user.orgId,
      branchId,
      user.userId,
      period,
      isJourney,
    );
  }

  @Get(':id/track')
  @Public()
  @Throttle(TicketController.PUBLIC_LOOKUP_THROTTLE)
  @ApiOperation({
    summary: 'Public ticket tracking — returns safe non-PII fields for the customer track page',
  })
  getTrack(@Param('id') id: string) {
    return this.ticketService.getTicketPublic(id);
  }

  @Patch(':id/track/preferences')
  @Public()
  @Throttle(TicketController.PUBLIC_ISSUE_THROTTLE)
  @ApiOperation({
    summary: 'Public update of ticket tracking preferences (e.g. transactional SMS)',
  })
  updateTrackPreferences(@Param('id') id: string, @Body() body: UpdateTicketPreferencesDto) {
    return this.ticketService.updateTrackPreferences(id, body);
  }

  /**
   * Server-Sent Events: emits when this ticket's queue changes (Redis `track:queue:{queueId}`).
   * Clients should refetch `GET /tickets/:id/track` on each message (payload is a lightweight hint).
   */
  @Sse(':id/track/stream')
  @Public()
  @Throttle(TicketController.PUBLIC_STREAM_THROTTLE)
  @ApiOperation({
    summary: 'Public SSE stream — nudges the track page to refetch when queue state changes',
  })
  trackStream(@Param('id') id: string): Observable<MessageEvent> {
    return this.ticketTrackSse.observeTicketStream(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ticketService.getById(user.orgId, id);
  }

  @Post('staff/issue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Issue a ticket from the authenticated staff dashboard (requires ticket:create on the branch)',
  })
  @RequirePermissions({ resource: 'ticket', action: 'create' })
  issueStaff(@CurrentUser() user: AuthenticatedUser, @Body() body: IssueTicketStaffDto) {
    return this.ticketService.issueTicket(
      user.orgId,
      { ...body, source: body.source ?? 'staff' },
      'authenticated',
    );
  }

  @Post('issue')
  @Public()
  @Throttle(TicketController.PUBLIC_ISSUE_THROTTLE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Issue a new ticket (public — kiosk and customer self-serve; never for staff — use POST /tickets/staff/issue)',
  })
  issue(@Body() body: IssueTicketDto) {
    return this.ticketService.issueTicket(
      body.orgId,
      { ...body, source: body.source ?? 'public' },
      'public',
    );
  }

  @Post('privacy/customer/anonymize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Anonymize customer/ticket PII for DSAR handling (respects legal_hold)',
  })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  anonymizeCustomerData(
    @CurrentUser() user: { orgId: string },
    @Body() body: AnonymizeCustomerDto,
  ) {
    return this.ticketService.anonymizeCustomerDataByIdentifier(user.orgId, body);
  }

  @Post('history/delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgOwnerGuard)
  @ApiOperation({
    summary: 'Permanently remove multiple tickets from history (organization owner only)',
  })
  deleteHistoryBulk(@CurrentUser() user: AuthenticatedUser, @Body() body: DeleteHistoryBulkDto) {
    return this.ticketService.deleteHistoryTicketsBulk(
      user.orgId,
      user.userId,
      body.ticketIds ?? [],
    );
  }

  @Post('call-next')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Call next ticket in queue. When deskFilterActive is true, only tickets assigned to the current desk are eligible.',
  })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  callNext(@CurrentUser() user: AuthenticatedUser, @Body() body: CallNextTicketDto) {
    return this.ticketService.callNext(
      user.orgId,
      body.queueId,
      body.deskNumber,
      user.userId,
      body.deskFilterActive ?? false,
    );
  }

  @Post('call-waiting')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Call a specific waiting ticket (classic console). Required for manual_only and ready_then_manual queue policies.',
  })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  callWaiting(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: CallWaitingTicketDto,
  ) {
    const userId = user.userId ?? user.id;
    if (!userId) throw new Error('User id required');
    return this.ticketService.callSpecific(
      user.orgId,
      body.ticketId,
      body.deskNumber,
      userId,
      'classic',
    );
  }

  @Post('call-specific')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgOwnerGuard)
  @ApiOperation({
    summary: 'Owner-only legacy alias: move a waiting ticket to queue front without calling it',
  })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  callSpecific(@CurrentUser() user: AuthenticatedUser, @Body() body: TicketIdBodyDto) {
    return this.ticketService.bringToFirst(user.orgId, body.ticketId, user.userId);
  }

  @Post('bring-to-first')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgOwnerOrAdminGuard)
  @ApiOperation({ summary: 'Owner/admin: move a waiting ticket to queue front without calling it' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  bringToFirst(@CurrentUser() user: AuthenticatedUser, @Body() body: TicketIdBodyDto) {
    return this.ticketService.bringToFirst(user.orgId, body.ticketId, user.userId);
  }

  @Post(':id/serve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start serving a ticket' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  serve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ticketService.serve(user.orgId, id, user.userId);
  }

  @Post(':id/update-estimates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update agent-led wait time estimates for a serving ticket' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  updateEstimates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateTicketEstimatesDto,
  ) {
    return this.ticketService.updateEstimates(user.orgId, id, body);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a ticket' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: CompleteTicketBodyDto,
  ) {
    const result = await this.ticketService.complete(
      user.orgId,
      id,
      user.userId,
      body?.externalRef,
    );
    return result.ticket;
  }

  @Post(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark ticket as no-show' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  noShow(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ticketService.noShow(user.orgId, id, user.userId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a ticket' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CancelTicketDto,
  ) {
    return this.ticketService.cancel(user.orgId, id, user.userId, body.reason);
  }

  @Post(':id/transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Transfer ticket to another queue. Optionally pass targetDeskNumber to immediately call the ticket at a specific desk in the target queue.',
  })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: TransferTicketBodyDto,
  ) {
    return this.ticketService.transfer(
      user.orgId,
      id,
      body.targetQueueId,
      user.userId,
      body.targetDeskNumber,
      body.externalRef,
    );
  }

  @Post(':id/mark-ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a waiting ticket as physically ready for pickup.' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  markReady(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ticketService.markReady(user.orgId, id, user.userId);
  }

  @Post(':id/change-desk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reassign an active ticket to a different desk (same queue)' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  changeDesk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ChangeDeskTicketDto,
  ) {
    return this.ticketService.changeDesk(user.orgId, id, body.targetDeskNumber, user.userId);
  }

  @Post(':id/recall')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-call a ticket' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  recall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ticketService.recall(user.orgId, id, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgOwnerGuard)
  @ApiOperation({ summary: 'Permanently remove a ticket from history (organization owner only)' })
  deleteFromHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ticketService.deleteHistoryTicket(user.orgId, user.userId, id);
  }
}
