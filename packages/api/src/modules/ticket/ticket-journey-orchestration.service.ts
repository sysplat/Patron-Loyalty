import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketActionSurfaceService } from './ticket-action-surface.service';
import { TicketIssuanceDepsBuilder, type IssuanceHost } from './ticket-issuance-deps.builder';
import { TicketIssuanceSideEffectsService } from './ticket-issuance-side-effects.service';
import { TicketJourneyTransitionService } from './ticket-journey-transition.service';
import { TicketTransitionService } from './ticket-transition.service';
import { TicketStatsCacheService } from './ticket-stats-cache.service';

type JourneyFinalizeHost = IssuanceHost & {
  emitTicketCalledNotification: (
    orgId: string,
    ticket: {
      id: string;
      customerPhone?: string | null;
      displayNumber?: string | null;
      deskNumber?: string | null;
      transactionalSmsAllowed?: boolean | null;
      queue?: { name?: string | null } | null;
    },
    deskNumberOverride?: string,
  ) => void;
};

@Injectable()
export class TicketJourneyOrchestrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actionSurface: TicketActionSurfaceService,
    private readonly journeyTransition: TicketJourneyTransitionService,
    private readonly issuanceDeps: TicketIssuanceDepsBuilder,
    private readonly issuanceSideEffects: TicketIssuanceSideEffectsService,
    private readonly ticketTransition: TicketTransitionService,
    private readonly statsCache: TicketStatsCacheService,
  ) {}

  async findTicketForActionResponse(
    db: PrismaService | Prisma.TransactionClient,
    orgId: string,
    ticketId: string,
  ) {
    return db.ticket.findFirst({
      where: { id: ticketId, orgId },
      include: {
        queue: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    });
  }

  async findActiveJourneyFollowUpTicket(
    db: PrismaService | Prisma.TransactionClient,
    orgId: string,
    currentTicketId: string,
    visitId: string | null,
    currentStepIndex: number | null,
  ) {
    if (!visitId) return null;
    return db.ticket.findFirst({
      where: {
        orgId,
        visitId,
        id: { not: currentTicketId },
        status: { in: ['waiting', 'called', 'serving'] },
        ...(typeof currentStepIndex === 'number' ? { stepIndex: { gt: currentStepIndex } } : {}),
      },
      orderBy: [{ stepIndex: 'asc' }, { bookedAt: 'asc' }],
      include: {
        queue: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    });
  }

  issueTicketCore(
    host: IssuanceHost,
    tx: Prisma.TransactionClient,
    orgId: string,
    data: Parameters<TicketIssuanceDepsBuilder['issueTicketCore']>[3],
  ) {
    return this.issuanceDeps.issueTicketCore(host, tx, orgId, data);
  }

  async finalizeTicketWithJourneyAdvance(
    host: JourneyFinalizeHost,
    orgId: string,
    ticketId: string,
    terminalStatus: 'completed' | 'no_show',
    externalRef?: string,
  ) {
    const sideEffects = {
      invalidateDerivedStats: (scopeOrgId: string, branchId: string, queueIds: string[]) =>
        this.statsCache.invalidateDerivedStats(scopeOrgId, branchId, queueIds),
    };

    return this.journeyTransition.finalizeTicketWithJourneyAdvance({
      orgId,
      ticketId,
      terminalStatus,
      externalRef,
      deps: {
        isQueueJourneyManaged: (db, scopeOrgId, queueId) =>
          this.actionSurface.isQueueJourneyManaged(db, scopeOrgId, queueId),
        findTicketForActionResponse: (db, scopeOrgId, scopeTicketId) =>
          this.findTicketForActionResponse(db, scopeOrgId, scopeTicketId),
        findActiveJourneyFollowUpTicket: (
          db,
          scopeOrgId,
          currentTicketId,
          visitId,
          currentStepIndex,
        ) =>
          this.findActiveJourneyFollowUpTicket(
            db,
            scopeOrgId,
            currentTicketId,
            visitId,
            currentStepIndex,
          ),
        issueTicketCore: (tx, scopeOrgId, data) => this.issueTicketCore(host, tx, scopeOrgId, data),
        transitionTicketCore: (tx, scopeOrgId, scopeTicketId, fromStatus, toStatus, extraData) =>
          this.ticketTransition.transitionTicketCore(
            tx,
            scopeOrgId,
            scopeTicketId,
            fromStatus,
            toStatus,
            extraData,
          ),
        emitTicketIssuedSideEffects: (scopeOrgId, ticket, queueId, branchId) =>
          this.issuanceSideEffects.emitTicketIssuedSideEffects(
            scopeOrgId,
            ticket,
            queueId,
            branchId,
            host.notifyTicketIssued,
          ),
        emitTicketCalledNotification: (scopeOrgId, ticket, deskNumberOverride) =>
          host.emitTicketCalledNotification(scopeOrgId, ticket, deskNumberOverride),
        emitTransitionSideEffects: (scopeOrgId, ticket, scopeTicketId, toStatus) =>
          this.ticketTransition.emitTransitionSideEffects(
            scopeOrgId,
            ticket,
            scopeTicketId,
            toStatus,
            sideEffects,
          ),
      },
    });
  }
}
