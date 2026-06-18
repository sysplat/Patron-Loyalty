import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketActionSurfaceService } from './ticket-action-surface.service';
import { TicketQueueContextService } from './ticket-queue-context.service';
import { TicketStatsCacheService } from './ticket-stats-cache.service';
import { TicketTransitionService } from './ticket-transition.service';
import type { TicketStaffActionDeps } from './ticket-staff-action.service';
import type { ActionSurface } from './ticket-action-surface.types';
import {
  clearTicketMetadataFlag,
  mergeTicketMetadata,
  ticketMetadataFlag,
} from './ticket-metadata.util';

export type TicketStaffActionHost = {
  stampRequestContext: (orgId: string, fields?: { ticketId?: string; queueId?: string }) => void;
  emitTicketCalledNotification: TicketStaffActionDeps['emitTicketCalledNotification'];
  notifyTicketRecalled: TicketStaffActionDeps['notifyTicketRecalled'];
  notifyAlmostReady: TicketStaffActionDeps['notifyAlmostReady'];
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
  finalizeTicketWithJourneyAdvance: (
    orgId: string,
    ticketId: string,
    terminalStatus: 'completed' | 'no_show',
    externalRef?: string,
  ) => Promise<unknown>;
};

@Injectable()
export class TicketStaffActionDepsBuilder {
  constructor(
    private readonly queueContext: TicketQueueContextService,
    private readonly actionSurface: TicketActionSurfaceService,
    private readonly statsCache: TicketStatsCacheService,
    private readonly ticketTransition: TicketTransitionService,
  ) {}

  build(host: TicketStaffActionHost): TicketStaffActionDeps {
    const transitionSideEffects = {
      invalidateDerivedStats: (orgId: string, branchId: string, queueIds: string[]) =>
        this.statsCache.invalidateDerivedStats(orgId, branchId, queueIds),
    };

    return {
      stampRequestContext: host.stampRequestContext,
      liveQueueBookedAtFloor: (orgId, context) =>
        this.queueContext.liveQueueBookedAtFloor(orgId, context),
      assertActionSurfaceForQueue: (db, orgId, queueId, actionSurface) =>
        this.actionSurface.assertActionSurfaceForQueue(
          db as Prisma.TransactionClient | PrismaService,
          orgId,
          queueId,
          actionSurface as ActionSurface,
        ),
      assertActionSurfaceForTicket: (db, orgId, ticketId, actionSurface) =>
        this.actionSurface.assertActionSurfaceForTicket(
          db as Prisma.TransactionClient | PrismaService,
          orgId,
          ticketId,
          actionSurface as ActionSurface,
        ),
      resolveQueueCallingPolicy: (db, orgId, queueId) =>
        this.queueContext.resolveQueueCallingPolicy(
          db as Prisma.TransactionClient | PrismaService,
          orgId,
          queueId,
        ),
      isReadyGatedPolicy: (policy) => this.queueContext.isReadyGatedPolicy(policy),
      assertTicketInLiveQueue: (bookedAt, bookedAtFloor) =>
        this.queueContext.assertTicketInLiveQueue(bookedAt, bookedAtFloor),
      invalidateDerivedStats: (orgId, branchId, queueIds) =>
        this.statsCache.invalidateDerivedStats(orgId, branchId, queueIds),
      canSendTransactionalSms: (ticket) =>
        Boolean(ticket.customerPhone) && ticket.transactionalSmsAllowed === true,
      emitTicketCalledNotification: host.emitTicketCalledNotification,
      notifyTicketRecalled: host.notifyTicketRecalled,
      notifyAlmostReady: host.notifyAlmostReady,
      transitionTicketCore: (tx, orgId, ticketId, fromStatus, toStatus, extraData) =>
        this.ticketTransition.transitionTicketCore(
          tx,
          orgId,
          ticketId,
          fromStatus,
          toStatus,
          extraData,
        ),
      emitTransitionSideEffects: (orgId, ticket, ticketId, toStatus) =>
        this.ticketTransition.emitTransitionSideEffects(
          orgId,
          ticket,
          ticketId,
          toStatus,
          transitionSideEffects,
        ),
      transitionTicket: (orgId, ticketId, fromStatus, toStatus, extraData) =>
        this.ticketTransition.transitionTicket(
          orgId,
          ticketId,
          fromStatus,
          toStatus,
          extraData,
          transitionSideEffects,
        ),
      finalizeTicketWithJourneyAdvance: (orgId, ticketId, terminalStatus, externalRef) =>
        host.finalizeTicketWithJourneyAdvance(orgId, ticketId, terminalStatus, externalRef),
      ticketMetadataFlag,
      clearTicketMetadataFlag,
      mergeTicketMetadata,
      reserveQueueDisplayNumber: (tx, orgId, queueId, opts) =>
        this.queueContext.reserveQueueDisplayNumber(tx, orgId, queueId, opts),
    };
  }
}
