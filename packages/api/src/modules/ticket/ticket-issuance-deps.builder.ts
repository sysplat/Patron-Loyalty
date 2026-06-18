import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketCustomerConsentService } from './ticket-customer-consent.service';
import { TicketIssuanceService, type TicketIssuancePlanLimits } from './ticket-issuance.service';
import { TicketIssuanceSideEffectsService } from './ticket-issuance-side-effects.service';
import { TicketJourneyFlowService } from './ticket-journey-flow.service';
import { TicketQueueContextService } from './ticket-queue-context.service';
import { TicketStatsCacheService } from './ticket-stats-cache.service';
import { BranchHoursService } from '../branch/branch-hours.service';

export type IssuanceHost = {
  planLimits: TicketIssuancePlanLimits;
  stampRequestContext: (orgId: string, fields?: { ticketId?: string; queueId?: string }) => void;
  notifyTicketIssued: (
    orgId: string,
    opts: {
      ticketId: string;
      displayNumber?: string | null;
      customerPhone?: string | undefined;
      serviceName?: string | null;
      transactionalSmsAllowed?: boolean;
    },
  ) => Promise<unknown>;
};

@Injectable()
export class TicketIssuanceDepsBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueContext: TicketQueueContextService,
    private readonly journeyFlow: TicketJourneyFlowService,
    private readonly customerConsent: TicketCustomerConsentService,
    private readonly issuanceSideEffects: TicketIssuanceSideEffectsService,
    private readonly statsCache: TicketStatsCacheService,
    private readonly ticketIssuance: TicketIssuanceService,
    private readonly branchHours: BranchHoursService,
  ) {}

  build(host: IssuanceHost) {
    return {
      prisma: this.prisma,
      planLimits: host.planLimits,
      stampRequestContext: host.stampRequestContext,
      getMonthlyTicketCount: (scopeOrgId: string) =>
        this.statsCache.getMonthlyTicketCount(scopeOrgId),
      isVisitJourneysEnabledForOrg: (
        scopeOrgId: string,
        db: Prisma.TransactionClient | PrismaService,
      ) => this.queueContext.isVisitJourneysEnabledForOrg(scopeOrgId, db),
      resolveEffectiveJourneyMode: (
        db: Prisma.TransactionClient | PrismaService,
        scopeOrgId: string,
        branchId: string,
        serviceId: string,
        queueId?: string,
      ) =>
        this.queueContext.resolveEffectiveJourneyMode(db, scopeOrgId, branchId, serviceId, queueId),
      reserveQueueDisplayNumber: (
        db: Prisma.TransactionClient,
        scopeOrgId: string,
        queueId: string,
        opts?: { enforceOpenForNonStaff?: boolean; source?: string },
      ) => this.queueContext.reserveQueueDisplayNumber(db, scopeOrgId, queueId, opts),
      resolveQueueCallingPolicy: (
        db: Prisma.TransactionClient | PrismaService,
        scopeOrgId: string,
        queueId: string,
      ) => this.queueContext.resolveQueueCallingPolicy(db, scopeOrgId, queueId),
      isReadyGatedPolicy: (policy?: string | null) => this.queueContext.isReadyGatedPolicy(policy),
      resolveFlowStepIndexForQueue: (
        db: Prisma.TransactionClient | PrismaService,
        scopeOrgId: string,
        branchId: string,
        queueId: string,
        visitId?: string,
      ) =>
        this.journeyFlow.resolveFlowStepIndexForQueue(db, scopeOrgId, branchId, queueId, visitId),
      resolveVisitExternalRef: (
        db: Prisma.TransactionClient | PrismaService,
        scopeOrgId: string,
        visitId: string,
        fallbackTicketId?: string | null,
      ) => this.journeyFlow.resolveVisitExternalRef(db, scopeOrgId, visitId, fallbackTicketId),
      logSmsConsentEvent: (input: {
        orgId: string;
        action: 'consent.sms.captured' | 'consent.sms.updated';
        resourceId?: string | null;
        metadata: Prisma.InputJsonObject;
      }) => this.customerConsent.logSmsConsentEvent(input),
      logMarketingConsent: (
        tx: Prisma.TransactionClient,
        input: {
          orgId: string;
          customerId: string;
          channel: 'sms' | 'email';
          status: 'GRANTED' | 'REVOKED';
          source: string;
          version: string;
        },
      ) => this.customerConsent.logMarketingConsent(tx, input),
      emitTicketIssuedSideEffects: (
        scopeOrgId: string,
        ticket: Parameters<TicketIssuanceSideEffectsService['emitTicketIssuedSideEffects']>[1],
        queueId: string,
        branchId: string,
      ) =>
        this.issuanceSideEffects.emitTicketIssuedSideEffects(
          scopeOrgId,
          ticket,
          queueId,
          branchId,
          host.notifyTicketIssued,
        ),
      assertBranchAcceptsCustomerIntake: (
        tx: Prisma.TransactionClient,
        scopeOrgId: string,
        branchId: string,
        actionLabel: string,
      ) =>
        this.branchHours.assertBranchAcceptsCustomerIntake(
          scopeOrgId,
          branchId,
          actionLabel,
          new Date(),
          tx,
        ),
    };
  }

  /** Compatibility shim: tests spy on `TicketService.issueTicketCore`. */
  async issueTicketCore(
    host: IssuanceHost,
    tx: Prisma.TransactionClient,
    orgId: string,
    data: Parameters<TicketIssuanceService['issueTicketCore']>[3],
  ) {
    return this.ticketIssuance.issueTicketCore(this.build(host), tx, orgId, data);
  }
}
