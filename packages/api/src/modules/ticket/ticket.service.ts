import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PlanLimitService } from '../billing/plan-limit.service';
import { WorkflowService } from '../workflow/workflow.service';
import { TicketStaffGuardService } from './ticket-staff-guard.service';
import { TicketJourneyFlowService } from './ticket-journey-flow.service';
import { TicketJourneyTransitionService } from './ticket-journey-transition.service';
import { TicketIssuanceService } from './ticket-issuance.service';
import { TicketPublicService } from './ticket-public.service';
import { TicketAnalyticsService } from './ticket-analytics.service';
import { TicketQueryService, ticketWaitingOrderBy } from './ticket-query.service';
import { TicketComplianceService } from './ticket-compliance.service';
import { TicketActionSurfaceService } from './ticket-action-surface.service';
import { TicketIssuanceSideEffectsService } from './ticket-issuance-side-effects.service';
import { TicketQueueContextService } from './ticket-queue-context.service';
import type { ActionSurface } from './ticket-action-surface.types';
import { TicketTransitionService } from './ticket-transition.service';
import { TicketRealtimeService } from './ticket-realtime.service';
import { TicketStaffActionService } from './ticket-staff-action.service';
import { TicketCustomerConsentService } from './ticket-customer-consent.service';
import { TicketVisitStepService } from './ticket-visit-step.service';
import { TicketEstimatesService } from './ticket-estimates.service';
import { TicketStatsCacheService } from './ticket-stats-cache.service';
import { TicketIssuanceDepsBuilder } from './ticket-issuance-deps.builder';
import { BranchHoursService } from '../branch/branch-hours.service';
import {
  TicketStaffActionDepsBuilder,
  type TicketStaffActionHost,
} from './ticket-staff-action-deps.builder';
import { TicketJourneyOrchestrationService } from './ticket-journey-orchestration.service';
import { maskCustomerName, maskCustomerPhoneE164 } from './ticket-masking.util';
import { emitTicketCalledNotification } from './ticket-notification.util';

type IssueTicketData = {
  queueId: string;
  branchId: string;
  serviceId: string;
  visitId?: string;
  stepIndex?: number;
  deskNumber?: string;
  initialStatus?: 'waiting' | 'called' | 'serving';
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  transactionalSmsAllowed?: boolean;
  source: string;
  priority?: number;
  language?: string;
  note?: string;
  externalRef?: string;
};

/**
 * Thin facade over bounded ticket domain services.
 */
@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);
  private readonly journeyFlow: TicketJourneyFlowService;
  private readonly journeyTransition: TicketJourneyTransitionService;
  private readonly ticketIssuance: TicketIssuanceService;
  private readonly ticketPublic: TicketPublicService;
  private readonly ticketAnalytics: TicketAnalyticsService;
  private readonly ticketQuery: TicketQueryService;
  private readonly ticketCompliance: TicketComplianceService;
  private readonly actionSurface: TicketActionSurfaceService;
  private readonly ticketTransition: TicketTransitionService;
  private readonly ticketRealtime: TicketRealtimeService;
  private readonly ticketStaffActions: TicketStaffActionService;
  private readonly customerConsent: TicketCustomerConsentService;
  private readonly visitStep: TicketVisitStepService;
  private readonly estimates: TicketEstimatesService;
  private readonly statsCache: TicketStatsCacheService;
  private readonly issuanceDepsBuilder: TicketIssuanceDepsBuilder;
  private readonly staffActionDepsBuilder: TicketStaffActionDepsBuilder;
  private readonly journeyOrchestration: TicketJourneyOrchestrationService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly planLimits: PlanLimitService,
    private readonly workflow: WorkflowService,
    private readonly requestContext: RequestContextService,
    private readonly staffGuards: TicketStaffGuardService,
    journeyFlow?: TicketJourneyFlowService,
    journeyTransition?: TicketJourneyTransitionService,
    ticketIssuance?: TicketIssuanceService,
    ticketPublic?: TicketPublicService,
    ticketAnalytics?: TicketAnalyticsService,
    ticketQuery?: TicketQueryService,
    ticketCompliance?: TicketComplianceService,
    actionSurface?: TicketActionSurfaceService,
    ticketTransition?: TicketTransitionService,
    ticketRealtime?: TicketRealtimeService,
    ticketStaffActions?: TicketStaffActionService,
    customerConsent?: TicketCustomerConsentService,
    visitStep?: TicketVisitStepService,
    estimates?: TicketEstimatesService,
    statsCache?: TicketStatsCacheService,
    queueContext?: TicketQueueContextService,
    issuanceSideEffects?: TicketIssuanceSideEffectsService,
    issuanceDepsBuilder?: TicketIssuanceDepsBuilder,
    staffActionDepsBuilder?: TicketStaffActionDepsBuilder,
    journeyOrchestration?: TicketJourneyOrchestrationService,
  ) {
    this.journeyFlow = journeyFlow ?? new TicketJourneyFlowService(this.prisma, this.workflow);
    this.journeyTransition =
      journeyTransition ?? new TicketJourneyTransitionService(this.prisma, this.journeyFlow);
    this.ticketIssuance = ticketIssuance ?? new TicketIssuanceService();
    this.ticketPublic = ticketPublic ?? new TicketPublicService();
    this.ticketAnalytics = ticketAnalytics ?? new TicketAnalyticsService(this.prisma, this.redis);
    this.ticketQuery = ticketQuery ?? new TicketQueryService(this.prisma, this.redis);
    this.ticketCompliance =
      ticketCompliance ?? new TicketComplianceService(this.prisma, this.audit, this.redis);
    this.actionSurface = actionSurface ?? new TicketActionSurfaceService(this.prisma, this.config);
    this.ticketRealtime =
      ticketRealtime ??
      new TicketRealtimeService(this.prisma, this.redis, this.config, this.requestContext);
    this.ticketTransition =
      ticketTransition ??
      new TicketTransitionService(
        this.prisma,
        this.redis,
        this.staffGuards,
        this.journeyFlow,
        this.ticketRealtime,
        new EventEmitter2(),
      );
    this.ticketStaffActions =
      ticketStaffActions ??
      new TicketStaffActionService(
        this.prisma,
        this.redis,
        this.audit,
        this.staffGuards,
        this.journeyFlow,
        this.ticketRealtime,
        this.ticketTransition,
      );
    this.statsCache = statsCache ?? new TicketStatsCacheService(this.prisma, this.redis);
    this.customerConsent =
      customerConsent ??
      new TicketCustomerConsentService(this.prisma, this.audit, this.requestContext);
    this.visitStep = visitStep ?? new TicketVisitStepService(this.prisma);
    this.estimates =
      estimates ??
      new TicketEstimatesService(
        this.prisma,
        this.redis,
        this.staffGuards,
        this.ticketRealtime,
        this.statsCache,
      );
    const resolvedQueueContext =
      queueContext ?? new TicketQueueContextService(this.prisma, this.redis, this.config);
    const resolvedIssuanceSideEffects =
      issuanceSideEffects ??
      new TicketIssuanceSideEffectsService(this.ticketRealtime, this.statsCache);
    this.issuanceDepsBuilder =
      issuanceDepsBuilder ??
      new TicketIssuanceDepsBuilder(
        this.prisma,
        resolvedQueueContext,
        this.journeyFlow,
        this.customerConsent,
        resolvedIssuanceSideEffects,
        this.statsCache,
        this.ticketIssuance,
        new BranchHoursService(this.prisma),
      );
    this.journeyOrchestration =
      journeyOrchestration ??
      new TicketJourneyOrchestrationService(
        this.prisma,
        this.actionSurface,
        this.journeyTransition,
        this.issuanceDepsBuilder,
        resolvedIssuanceSideEffects,
        this.ticketTransition,
        this.statsCache,
      );
    this.staffActionDepsBuilder =
      staffActionDepsBuilder ??
      new TicketStaffActionDepsBuilder(
        resolvedQueueContext,
        this.actionSurface,
        this.statsCache,
        this.ticketTransition,
      );
  }

  private stampRequestContext(
    orgId: string,
    fields?: { ticketId?: string; queueId?: string },
  ): void {
    this.requestContext.setOrgId(orgId);
    if (fields?.ticketId) this.requestContext.setTicketId(fields.ticketId);
    if (fields?.queueId) this.requestContext.setQueueId(fields.queueId);
  }

  private buildIssuanceHost() {
    return {
      planLimits: this.planLimits,
      stampRequestContext: (orgId: string, fields?: { ticketId?: string; queueId?: string }) =>
        this.stampRequestContext(orgId, fields),
      notifyTicketIssued: (
        orgId: string,
        opts: Parameters<NotificationService['notifyTicketIssued']>[1],
      ) => this.notifications.notifyTicketIssued(orgId, opts),
    };
  }

  private buildStaffActionHost(): TicketStaffActionHost {
    return {
      stampRequestContext: (orgId, fields) => this.stampRequestContext(orgId, fields),
      emitTicketCalledNotification: (orgId, ticket, deskNumberOverride) =>
        emitTicketCalledNotification(
          this.notifications,
          this.logger,
          orgId,
          ticket,
          deskNumberOverride,
        ),
      notifyTicketRecalled: (orgId, ticketId, opts) =>
        this.notifications.notifyTicketRecalled(orgId, ticketId, opts),
      notifyAlmostReady: (orgId, ticketId, position, customerPhone, opts) =>
        this.notifications.notifyTicketAlmostReady(orgId, ticketId, position, customerPhone, opts),
      notifyTicketIssued: (orgId, opts) => this.notifications.notifyTicketIssued(orgId, opts),
      finalizeTicketWithJourneyAdvance: (orgId, ticketId, terminalStatus, externalRef) =>
        this.finalizeTicketWithJourneyAdvance(orgId, ticketId, terminalStatus, externalRef),
    };
  }

  private staffDeps() {
    return this.staffActionDepsBuilder.build(this.buildStaffActionHost());
  }

  private buildTransitionSideEffects() {
    return {
      invalidateDerivedStats: (orgId: string, branchId: string, queueIds: string[]) =>
        this.statsCache.invalidateDerivedStats(orgId, branchId, queueIds),
    };
  }

  private buildTicketComplianceSideEffects() {
    return {
      invalidateDerivedStats: (orgId: string, branchId: string, queueIds: string[]) =>
        this.statsCache.invalidateDerivedStats(orgId, branchId, queueIds),
      publishMany: (events: Array<{ channel: string; event: string; data: unknown }>) =>
        this.ticketRealtime.publishMany(events),
      refreshVisitStatus: (orgId: string, visitId?: string | null) =>
        this.ticketTransition.refreshVisitStatus(orgId, visitId),
    };
  }

  private buildTicketPublicDeps() {
    return {
      prisma: this.prisma,
      redis: this.redis,
      waitingOrderBy: () => ticketWaitingOrderBy(),
      maskCustomerName,
      maskCustomerPhoneE164,
    };
  }

  /** Compatibility shim: tests spy on `TicketService.issueTicketCore`. */
  private async issueTicketCore(
    tx: Prisma.TransactionClient,
    orgId: string,
    data: Parameters<TicketIssuanceService['issueTicketCore']>[3],
  ) {
    return this.journeyOrchestration.issueTicketCore(this.buildIssuanceHost(), tx, orgId, data);
  }

  private transitionTicketCore(
    tx: Prisma.TransactionClient,
    orgId: string,
    ticketId: string,
    fromStatus: string | string[],
    toStatus: string,
    extraData: Record<string, unknown>,
  ) {
    return this.ticketTransition.transitionTicketCore(
      tx,
      orgId,
      ticketId,
      fromStatus,
      toStatus,
      extraData,
    );
  }

  private emitTransitionSideEffects(
    orgId: string,
    ticket: { queueId: string; branchId: string; orgId: string; visitId?: string | null },
    ticketId: string,
    toStatus: string,
  ) {
    this.ticketTransition.emitTransitionSideEffects(
      orgId,
      ticket,
      ticketId,
      toStatus,
      this.buildTransitionSideEffects(),
    );
  }

  private transitionTicket(
    orgId: string,
    ticketId: string,
    fromStatus: string | string[],
    toStatus: string,
    extraData: Record<string, unknown>,
  ) {
    return this.ticketTransition.transitionTicket(
      orgId,
      ticketId,
      fromStatus,
      toStatus,
      extraData,
      this.buildTransitionSideEffects(),
    );
  }

  private refreshVisitStatus(orgId: string, visitId?: string | null): Promise<void> {
    return this.ticketTransition.refreshVisitStatus(orgId, visitId);
  }

  /** Compatibility shim: tests spy on `TicketService.finalizeTicketWithJourneyAdvance`. */
  private async finalizeTicketWithJourneyAdvance(
    orgId: string,
    ticketId: string,
    terminalStatus: 'completed' | 'no_show',
    externalRef?: string,
  ) {
    return this.journeyOrchestration.finalizeTicketWithJourneyAdvance(
      {
        ...this.buildIssuanceHost(),
        emitTicketCalledNotification: (scopeOrgId, ticket, deskNumberOverride) =>
          emitTicketCalledNotification(
            this.notifications,
            this.logger,
            scopeOrgId,
            ticket,
            deskNumberOverride,
          ),
      },
      orgId,
      ticketId,
      terminalStatus,
      externalRef,
    );
  }

  async list(orgId: string, filters: Parameters<TicketQueryService['list']>[1]) {
    return this.ticketQuery.list(orgId, filters);
  }

  async listForPrincipal(
    orgId: string,
    userId: string,
    filters: Parameters<TicketQueryService['listForPrincipal']>[2],
  ) {
    return this.ticketQuery.listForPrincipal(orgId, userId, filters);
  }

  async getById(orgId: string, ticketId: string) {
    return this.ticketQuery.getById(orgId, ticketId);
  }

  async getByDisplayNumber(orgId: string, branchId: string, displayNumber: string) {
    return this.ticketQuery.getByDisplayNumber(orgId, branchId, displayNumber);
  }

  async getTicketPublic(ticketId: string) {
    return this.ticketPublic.getTicketPublic(this.buildTicketPublicDeps(), ticketId);
  }

  async updateTrackPreferences(ticketId: string, data: { transactionalSmsAllowed: boolean }) {
    return this.customerConsent.updateTrackPreferences(ticketId, data);
  }

  async listSmsConsentAudit(orgId: string, opts?: { page?: number; limit?: number }) {
    return this.ticketQuery.listSmsConsentAudit(orgId, opts);
  }

  async getVisitPublic(visitIdOrToken: string) {
    return this.ticketPublic.getVisitPublic(this.buildTicketPublicDeps(), visitIdOrToken);
  }

  async createVisitStep(
    orgId: string,
    visitId: string,
    data: Parameters<TicketVisitStepService['createVisitStep']>[3],
  ) {
    return this.visitStep.createVisitStep(
      (scopeOrgId, payload, issuance) => this.issueTicket(scopeOrgId, payload, issuance),
      orgId,
      visitId,
      data,
    );
  }

  async getPublicDisplayBoard(branchId: string) {
    return this.ticketPublic.getPublicDisplayBoard(this.buildTicketPublicDeps(), branchId);
  }

  async issueTicket(
    orgIdOrNull: string | null | undefined,
    data: IssueTicketData,
    issuance: 'public' | 'authenticated' = 'public',
  ) {
    return this.ticketIssuance.issueTicket(
      this.issuanceDepsBuilder.build(this.buildIssuanceHost()),
      orgIdOrNull,
      data,
      issuance,
    );
  }

  async callNext(
    orgId: string,
    queueId: string,
    deskNumber: string,
    userId: string,
    deskFilterActive = false,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.callNext(
      this.staffDeps(),
      orgId,
      queueId,
      deskNumber,
      userId,
      deskFilterActive,
      actionSurface,
    );
  }

  async callSpecific(
    orgId: string,
    ticketId: string,
    deskNumber: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.callSpecific(
      this.staffDeps(),
      orgId,
      ticketId,
      deskNumber,
      userId,
      actionSurface,
    );
  }

  async bringToFirst(orgId: string, ticketId: string, userId: string) {
    return this.ticketStaffActions.bringToFirst(this.staffDeps(), orgId, ticketId, userId);
  }

  async markReady(
    orgId: string,
    ticketId: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.markReady(
      this.staffDeps(),
      orgId,
      ticketId,
      userId,
      actionSurface,
    );
  }

  async serve(
    orgId: string,
    ticketId: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.serve(this.staffDeps(), orgId, ticketId, userId, actionSurface);
  }

  async complete(
    orgId: string,
    ticketId: string,
    userId: string,
    externalRef?: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.complete(
      this.staffDeps(),
      orgId,
      ticketId,
      userId,
      externalRef,
      actionSurface,
    );
  }

  async repairJourneyFlowQueueLinks(orgId: string, branchId: string, queueId?: string) {
    const templateId = await this.journeyFlow.resolveFlowTemplateId(
      this.prisma,
      orgId,
      branchId,
      queueId,
    );
    if (!templateId) {
      return { repaired: 0 };
    }
    return this.journeyFlow.repairStaleFlowStepQueueLinks(orgId, branchId, templateId);
  }

  async noShow(
    orgId: string,
    ticketId: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.noShow(this.staffDeps(), orgId, ticketId, userId, actionSurface);
  }

  async cancel(
    orgId: string,
    ticketId: string,
    actorUserId?: string,
    reason?: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.cancel(
      this.staffDeps(),
      orgId,
      ticketId,
      actorUserId,
      reason,
      actionSurface,
    );
  }

  async transfer(
    orgId: string,
    ticketId: string,
    targetQueueId: string | undefined,
    actorUserId: string,
    targetDeskNumber?: string,
    externalRef?: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.transfer(
      this.staffDeps(),
      orgId,
      ticketId,
      targetQueueId,
      actorUserId,
      targetDeskNumber,
      externalRef,
      actionSurface,
    );
  }

  async recall(
    orgId: string,
    ticketId: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
    notifyDeskNumber?: string,
  ) {
    return this.ticketStaffActions.recall(
      this.staffDeps(),
      orgId,
      ticketId,
      userId,
      actionSurface,
      notifyDeskNumber,
    );
  }

  async changeDesk(
    orgId: string,
    ticketId: string,
    targetDeskNumber: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    return this.ticketStaffActions.changeDesk(
      this.staffDeps(),
      orgId,
      ticketId,
      targetDeskNumber,
      userId,
      actionSurface,
    );
  }

  async getQueueStats(orgId: string, queueId: string, period: 'today' | 'week' = 'today') {
    return this.ticketAnalytics.getQueueStats(orgId, queueId, period);
  }

  async getAgentPerformance(
    orgId: string,
    queueId: string,
    userId: string,
    period: 'today' | 'week' = 'today',
  ) {
    return this.ticketAnalytics.getAgentPerformance(orgId, queueId, userId, period);
  }

  async getBranchAgentPerformance(
    orgId: string,
    branchId: string,
    userId: string,
    period: 'today' | 'week' = 'today',
    forJourney?: boolean,
  ) {
    return this.ticketAnalytics.getBranchAgentPerformance(
      orgId,
      branchId,
      userId,
      period,
      forJourney,
    );
  }

  async getLiveOperations(
    orgId: string,
    filters: { branchId?: string; allowedBranchIds?: string[] | null; period?: 'today' | 'week' },
  ) {
    return this.ticketAnalytics.getLiveOperations(orgId, filters);
  }

  async getLiveOperationsForPrincipal(
    orgId: string,
    userId: string,
    filters: { branchId?: string; period?: 'today' | 'week' },
  ) {
    return this.ticketAnalytics.getLiveOperationsForPrincipal(orgId, userId, filters);
  }

  async anonymizeHistoricalPii(retentionDays: number, dryRun = false) {
    return this.ticketCompliance.anonymizeHistoricalPii(retentionDays, dryRun);
  }

  async anonymizeCustomerDataByIdentifier(
    orgId: string,
    input: { customerId?: string; phone?: string; email?: string; dryRun?: boolean },
  ) {
    return this.ticketCompliance.anonymizeCustomerDataByIdentifier(orgId, input);
  }

  async updateEstimates(
    orgId: string,
    ticketId: string,
    data: { estimatedRemainingMins?: number | null },
  ) {
    return this.estimates.updateEstimates(orgId, ticketId, data);
  }

  async deleteHistoryTicket(orgId: string, actorUserId: string, ticketId: string) {
    return this.ticketCompliance.deleteHistoryTicket(
      this.buildTicketComplianceSideEffects(),
      orgId,
      actorUserId,
      ticketId,
    );
  }

  async deleteHistoryTicketsBulk(orgId: string, actorUserId: string, ticketIds: string[]) {
    return this.ticketCompliance.deleteHistoryTicketsBulk(
      this.buildTicketComplianceSideEffects(),
      orgId,
      actorUserId,
      ticketIds,
    );
  }

  async expireStaleTickets(thresholdMinutes = 120): Promise<number> {
    return this.ticketCompliance.expireStaleTickets(
      this.buildTicketComplianceSideEffects(),
      thresholdMinutes,
    );
  }

  async closePriorSessionWaitingTickets(options?: {
    dryRun?: boolean;
    orgId?: string;
    branchId?: string;
  }) {
    return this.ticketCompliance.closePriorSessionWaitingTickets(
      this.buildTicketComplianceSideEffects(),
      options,
    );
  }

  /** Single round-trip payload for single-step agent console (live tickets + counts). */
  async getQueueLiveSliceForPrincipal(
    orgId: string,
    userId: string,
    queueId: string,
    period: 'today' | 'week' = 'today',
  ) {
    const [list, stats] = await Promise.all([
      this.listForPrincipal(orgId, userId, {
        queueId,
        status: 'waiting,called,serving',
        period,
        limit: 100,
      }),
      this.getQueueStats(orgId, queueId, period),
    ]);
    return { tickets: list.data, stats };
  }
}
