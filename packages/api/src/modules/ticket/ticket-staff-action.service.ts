import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { userCanUseFifoManualCall } from '../../common/rbac/org-owner.util';
import { Prisma } from '@prisma/client';
import { journeyStepAcceptsExternalRef } from '@queueplatform/shared';
import type { EffectiveTimezoneContext } from '../../common/resolve-effective-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../common/audit/audit.service';
import { TicketStaffGuardService } from './ticket-staff-guard.service';
import { TicketJourneyFlowService } from './ticket-journey-flow.service';
import { TicketRealtimeService } from './ticket-realtime.service';
import { TicketTransitionService } from './ticket-transition.service';
import type { ActionSurface } from './ticket-action-surface.types';

import {
  clearTicketMetadataFlag,
  mergeTicketMetadata,
  METADATA_RESUMMON_SMS_ON_SERVE,
  ticketMetadataFlag,
} from './ticket-metadata.util';

export type TicketStaffActionDeps = {
  stampRequestContext: (orgId: string, fields?: { ticketId?: string; queueId?: string }) => void;
  liveQueueBookedAtFloor: (orgId: string, context?: EffectiveTimezoneContext) => Promise<Date>;
  assertActionSurfaceForQueue: (
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    queueId: string,
    actionSurface: ActionSurface,
  ) => Promise<void>;
  assertActionSurfaceForTicket: (
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    ticketId: string,
    actionSurface: ActionSurface,
  ) => Promise<void>;
  resolveQueueCallingPolicy: (
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    queueId: string,
  ) => Promise<string>;
  isReadyGatedPolicy: (policy?: string | null) => boolean;
  assertTicketInLiveQueue: (bookedAt: Date, bookedAtFloor: Date) => void;
  invalidateDerivedStats: (orgId: string, branchId: string, queueIds: string[]) => Promise<void>;
  canSendTransactionalSms: (ticket: {
    customerPhone?: string | null;
    transactionalSmsAllowed?: boolean | null;
  }) => boolean;
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
  notifyTicketRecalled: (
    orgId: string,
    ticketId: string,
    opts?: {
      displayNumber?: string;
      deskNumber?: string;
      customerPhone?: string;
      queueName?: string;
      transactionalSmsAllowed?: boolean;
      isUndo?: boolean;
    },
  ) => Promise<unknown>;
  notifyAlmostReady: (
    orgId: string,
    ticketId: string,
    position: number,
    customerPhone?: string,
    opts?: { servingDeskNumber?: string | null; queueName?: string | null },
  ) => Promise<void>;
  transitionTicketCore: (
    tx: Prisma.TransactionClient,
    orgId: string,
    ticketId: string,
    fromStatus: string | string[],
    toStatus: string,
    extraData: Record<string, unknown>,
  ) => Promise<any>;
  emitTransitionSideEffects: (
    orgId: string,
    ticket: { queueId: string; branchId: string; orgId: string; visitId?: string | null },
    ticketId: string,
    toStatus: string,
  ) => void;
  transitionTicket: (
    orgId: string,
    ticketId: string,
    fromStatus: string | string[],
    toStatus: string,
    extraData: Record<string, unknown>,
  ) => Promise<any>;
  finalizeTicketWithJourneyAdvance: (
    orgId: string,
    ticketId: string,
    terminalStatus: 'completed' | 'no_show',
    externalRef?: string,
  ) => Promise<any>;
  ticketMetadataFlag: (metadata: Prisma.JsonValue | null | undefined, key: string) => boolean;
  clearTicketMetadataFlag: (metadata: Prisma.JsonValue | null | undefined, key: string) => any;
  mergeTicketMetadata: (
    metadata: Prisma.JsonValue | null | undefined,
    patch: Record<string, unknown>,
  ) => any;
  reserveQueueDisplayNumber: (
    tx: Prisma.TransactionClient,
    orgId: string,
    queueId: string,
    opts?: { enforceOpenForNonStaff?: boolean; source?: string },
  ) => Promise<{ displayNumber: string; status: string }>;
};

@Injectable()
export class TicketStaffActionService {
  private readonly logger = new Logger(TicketStaffActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly staffGuards: TicketStaffGuardService,
    private readonly journeyFlow: TicketJourneyFlowService,
    private readonly ticketRealtime: TicketRealtimeService,
    private readonly ticketTransition: TicketTransitionService,
  ) {}

  async callNext(
    deps: TicketStaffActionDeps,
    orgId: string,
    queueId: string,
    deskNumber: string,
    userId: string,
    deskFilterActive = false,
    actionSurface: ActionSurface = 'classic',
  ) {
    deps.stampRequestContext(orgId, { queueId });
    this.logger.debug(
      `callNext → orgId=${orgId} queueId=${queueId} deskNumber=${deskNumber} userId=${userId} deskFilterActive=${deskFilterActive}`,
    );

    const bookedAtFloor = await deps.liveQueueBookedAtFloor(orgId, { queueId });

    const ticket = await this.prisma.withTenant(
      orgId,
      async (tx) => {
        await deps.assertActionSurfaceForQueue(tx, orgId, queueId, actionSurface);
        const queue = await tx.queue.findUnique({
          where: { id: queueId, orgId },
          select: { branchId: true, status: true },
        });
        if (!queue) throw new NotFoundException('Queue not found');
        await this.staffGuards.assertStaffQueueActionAllowed(
          tx,
          orgId,
          queueId,
          queue.branchId,
          'calling next',
          'customer_intake',
        );
        const callingPolicy = await deps.resolveQueueCallingPolicy(tx, orgId, queueId);
        if (callingPolicy === 'manual_only' || callingPolicy === 'ready_then_manual') {
          throw new BadRequestException(
            'This queue requires manual call. Use "Call" on a specific ticket.',
          );
        }

        if (actionSurface === 'workbench') {
          const activeSession = await tx.agentSession.findFirst({
            where: {
              branchId: queue.branchId,
              deskNumber,
              surface: 'journey',
              endedAt: null,
              userId,
            },
          });
          if (!activeSession) {
            throw new BadRequestException(
              `Cannot call next customer: Sign in at desk ${deskNumber} on the multi-step page first (workbench session required).`,
            );
          }
        } else {
          await this.staffGuards.assertClassicDeskAssignmentForBranch(
            tx,
            orgId,
            userId,
            queue.branchId,
            {
              requiredDeskNumber: deskNumber,
            },
          );
          const desk = await tx.desk.findUnique({
            where: { branchId_number: { branchId: queue.branchId, number: deskNumber } },
          });
          if (!desk || desk.status !== 'open') {
            throw new BadRequestException(
              `Cannot call next customer: Desk ${deskNumber} is currently closed.`,
            );
          }
        }

        // CORE: Pessimistic locking to prevent double calls.
        // When desk filter is active, prefer tickets assigned to this desk,
        // but still allow unassigned waiting tickets (for kiosk/public intake).
        const deskEligibilityFilter = deskFilterActive
          ? Prisma.sql`AND (desk_number = ${deskNumber} OR desk_number IS NULL)`
          : Prisma.empty;
        const ordering = deskFilterActive
          ? Prisma.sql`
                    ORDER BY
                        CASE WHEN desk_number = ${deskNumber} THEN 0 ELSE 1 END,
                        CASE WHEN position IS NULL THEN 1 ELSE 0 END,
                        position ASC,
                        booked_at ASC
                `
          : Prisma.sql`
                    ORDER BY
                        CASE WHEN position IS NULL THEN 1 ELSE 0 END,
                        position ASC,
                        booked_at ASC
                `;

        const result = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
                SELECT id FROM tickets
                WHERE queue_id = ${queueId}::uuid AND org_id = ${orgId}::uuid
                AND status = 'waiting'
                AND booked_at >= ${bookedAtFloor}
                ${callingPolicy === 'ready_then_fifo' ? Prisma.sql`AND ready_at IS NOT NULL` : Prisma.empty}
                ${deskEligibilityFilter}
                ${ordering}
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            `);

        const ticketId = result[0]?.id;
        if (!ticketId) {
          if (callingPolicy === 'ready_then_fifo') {
            const waitingWhere: Prisma.TicketWhereInput = {
              orgId,
              queueId,
              status: 'waiting',
              bookedAt: { gte: bookedAtFloor },
              ...(deskFilterActive ? { OR: [{ deskNumber }, { deskNumber: null }] } : {}),
            };
            const [waitingTotal, readyTotal] = await Promise.all([
              tx.ticket.count({ where: waitingWhere }),
              tx.ticket.count({ where: { ...waitingWhere, readyAt: { not: null } } }),
            ]);
            if (waitingTotal > 0 && readyTotal === 0) {
              throw new BadRequestException(
                'Customers are waiting, but none are marked Ready yet. Mark tickets as Ready before using Call Next.',
              );
            }
          }
          throw new NotFoundException('No waiting tickets in this queue');
        }

        return tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: 'called',
            calledAt: new Date(),
            servedByUserId: userId,
            deskNumber,
            position: null,
          },
          include: {
            queue: {
              select: {
                id: true,
                name: true,
                journeyModeOverride: true,
                flowTemplateId: true,
              },
            },
            service: { select: { id: true, name: true } },
          },
        });
      },
      // callNext may run multiple counts on ready-gated queues + pessimistic lock; 5s tx can be too tight.
      { timeoutMs: 25_000, maxWaitMs: 10_000 },
    );

    if (ticket) {
      deps.stampRequestContext(orgId, { queueId, ticketId: ticket.id });
      this.ticketRealtime.publishMany([
        { channel: `queue:${queueId}`, event: 'ticket.called', data: ticket },
        { channel: `display:${ticket.branchId}`, event: 'ticket.called', data: ticket },
        { channel: `org:${orgId}`, event: 'ticket.called', data: ticket },
      ]);
      deps.invalidateDerivedStats(orgId, ticket.branchId, [queueId]).catch(() => {});
      this.redis.del(`cache:ticket-public:${ticket.id}`).catch(() => {});

      if (deps.canSendTransactionalSms(ticket)) {
        deps.emitTicketCalledNotification(orgId, ticket, deskNumber);
      }

      this.ticketRealtime
        .notifyAlmostReadyTickets(orgId, queueId, {
          liveQueueBookedAtFloor: (scopeOrgId, context) =>
            deps.liveQueueBookedAtFloor(scopeOrgId, context),
          notifyAlmostReady: deps.notifyAlmostReady,
        })
        .catch((error: Error) => {
          this.logger.warn(
            `Almost-ready SMS notification check failed for queue ${queueId}: ${error.message}`,
          );
        });
    }

    return ticket;
  }

  /**
   * Call a specific ticket by ID — allows agents to manually override FIFO ordering.
   * Uses the same pessimistic locking, desk/queue validation, and notification
   * pipeline as `callNext`, but targets a known ticket rather than the next in line.
   */
  async callSpecific(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    deskNumber: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    deps.stampRequestContext(orgId, { ticketId });
    this.logger.debug(
      `callSpecific → orgId=${orgId} ticketId=${ticketId} deskNumber=${deskNumber} userId=${userId}`,
    );

    const ticket = await this.prisma.withTenant(
      orgId,
      async (tx) => {
        await deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface);
        const target = await tx.ticket.findUnique({
          where: { id: ticketId, orgId },
          select: {
            id: true,
            queueId: true,
            branchId: true,
            status: true,
            readyAt: true,
            bookedAt: true,
          },
        });
        if (!target) throw new NotFoundException('Ticket not found');
        deps.stampRequestContext(orgId, { ticketId, queueId: target.queueId });
        if (target.status !== 'waiting') {
          throw new BadRequestException(
            `Cannot call ticket — current status is "${target.status}" (must be "waiting")`,
          );
        }
        const bookedAtFloor = await deps.liveQueueBookedAtFloor(orgId, { queueId: target.queueId });
        deps.assertTicketInLiveQueue(target.bookedAt, bookedAtFloor);

        const queue = await tx.queue.findUnique({
          where: { id: target.queueId, orgId },
          select: { branchId: true, status: true },
        });
        if (!queue) throw new NotFoundException('Queue not found');
        await this.staffGuards.assertStaffQueueActionAllowed(
          tx,
          orgId,
          target.queueId,
          queue.branchId,
          'calling tickets',
          'customer_intake',
        );
        const callingPolicy = await deps.resolveQueueCallingPolicy(tx, orgId, target.queueId);
        const canFifoManualCall = await userCanUseFifoManualCall(tx, orgId, userId, queue.branchId);
        if (
          (callingPolicy === 'fifo' || callingPolicy === 'ready_then_fifo') &&
          !canFifoManualCall
        ) {
          throw new BadRequestException(
            'This step uses Call Next only. Use Call Next instead of calling a specific customer.',
          );
        }
        if (callingPolicy === 'ready_then_manual' && !target.readyAt) {
          throw new BadRequestException('Ticket must be marked ready before calling');
        }

        if (actionSurface === 'workbench') {
          const activeSession = await tx.agentSession.findFirst({
            where: {
              branchId: queue.branchId,
              deskNumber,
              surface: 'journey',
              endedAt: null,
              userId,
            },
          });
          if (!activeSession) {
            throw new BadRequestException(
              `Cannot call ticket: Sign in at desk ${deskNumber} on the multi-step page first (workbench session required).`,
            );
          }
        } else {
          await this.staffGuards.assertClassicDeskAssignmentForBranch(
            tx,
            orgId,
            userId,
            queue.branchId,
            {
              requiredDeskNumber: deskNumber,
            },
          );
          const desk = await tx.desk.findUnique({
            where: { branchId_number: { branchId: queue.branchId, number: deskNumber } },
          });
          if (!desk || desk.status !== 'open') {
            throw new BadRequestException(
              `Cannot call ticket: Desk ${deskNumber} is currently closed.`,
            );
          }
        }

        // Pessimistic lock on the specific ticket to prevent concurrent calls
        const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
                SELECT id FROM tickets
                WHERE id = ${ticketId}::uuid AND org_id = ${orgId}::uuid AND status = 'waiting'
                AND booked_at >= ${bookedAtFloor}
                FOR UPDATE SKIP LOCKED
            `);
        if (locked.length === 0) {
          throw new BadRequestException(
            'Ticket is no longer available (it may have been called by another agent)',
          );
        }

        return tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: 'called',
            calledAt: new Date(),
            servedByUserId: userId,
            deskNumber,
          },
          include: {
            queue: {
              select: {
                id: true,
                name: true,
                journeyModeOverride: true,
                flowTemplateId: true,
              },
            },
            service: { select: { id: true, name: true } },
          },
        });
      },
      // callSpecific does a pessimistic lock + multiple reads; the default 5s interactive-tx
      // timeout is too tight under load or cold cache.
      { timeoutMs: 25_000, maxWaitMs: 10_000 },
    );

    if (ticket) {
      const queueId = ticket.queueId;
      this.ticketRealtime.publishMany([
        { channel: `queue:${queueId}`, event: 'ticket.called', data: ticket },
        { channel: `display:${ticket.branchId}`, event: 'ticket.called', data: ticket },
        { channel: `org:${orgId}`, event: 'ticket.called', data: ticket },
      ]);
      deps.invalidateDerivedStats(orgId, ticket.branchId, [queueId]).catch(() => {});
      this.redis.del(`cache:ticket-public:${ticket.id}`).catch(() => {});

      if (deps.canSendTransactionalSms(ticket)) {
        deps.emitTicketCalledNotification(orgId, ticket, deskNumber);
      }

      this.ticketRealtime
        .notifyAlmostReadyTickets(orgId, queueId, {
          liveQueueBookedAtFloor: (scopeOrgId, context) =>
            deps.liveQueueBookedAtFloor(scopeOrgId, context),
          notifyAlmostReady: deps.notifyAlmostReady,
        })
        .catch((error: Error) => {
          this.logger.warn(
            `Almost-ready SMS notification check failed for queue ${queueId}: ${error.message}`,
          );
        });
    }

    return ticket;
  }

  async bringToFirst(deps: TicketStaffActionDeps, orgId: string, ticketId: string, userId: string) {
    const targetPeek = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.findFirst({
        where: { id: ticketId, orgId },
        select: { queueId: true },
      }),
    );
    if (!targetPeek) throw new NotFoundException('Ticket not found');

    const bookedAtFloor = await deps.liveQueueBookedAtFloor(orgId, { queueId: targetPeek.queueId });

    const updated = await this.prisma.withTenant(orgId, async (tx) => {
      const target = await tx.ticket.findUnique({
        where: { id: ticketId, orgId },
        select: {
          id: true,
          queueId: true,
          branchId: true,
          status: true,
          position: true,
          bookedAt: true,
        },
      });
      if (!target) throw new NotFoundException('Ticket not found');
      if (target.status !== 'waiting') {
        throw new BadRequestException('Only waiting tickets can be moved to first.');
      }
      deps.assertTicketInLiveQueue(target.bookedAt, bookedAtFloor);

      const queue = await tx.queue.findUnique({
        where: { id: target.queueId, orgId },
        select: { id: true, status: true, branchId: true },
      });
      if (!queue) throw new NotFoundException('Queue not found');
      await this.staffGuards.assertStaffQueueActionAllowed(
        tx,
        orgId,
        target.queueId,
        queue.branchId,
        'reordering tickets',
        'customer_intake',
      );

      const firstPositioned = await tx.ticket.findFirst({
        where: {
          orgId,
          queueId: target.queueId,
          status: 'waiting',
          bookedAt: { gte: bookedAtFloor },
          position: { not: null },
          id: { not: ticketId },
        },
        orderBy: { position: 'asc' },
        select: { position: true },
      });
      const nextPosition = firstPositioned ? firstPositioned.position! - 1 : -1;

      return tx.ticket.update({
        where: { id: ticketId },
        data: { position: nextPosition },
        include: {
          queue: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
      });
    });

    this.ticketRealtime.publishMany([
      { channel: `queue:${updated.queueId}`, event: 'ticket.prioritized', data: updated },
      { channel: `display:${updated.branchId}`, event: 'ticket.prioritized', data: updated },
      { channel: `org:${orgId}`, event: 'ticket.prioritized', data: updated },
    ]);
    deps.invalidateDerivedStats(orgId, updated.branchId, [updated.queueId]).catch(() => {});

    await this.audit.logActivity({
      orgId,
      userId,
      action: 'ticket.bring_to_first',
      resourceType: 'ticket',
      resourceId: updated.id,
      metadata: { queueId: updated.queueId, position: updated.position },
    });
    await this.audit.logAudit({
      orgId,
      userId,
      action: 'update',
      tableName: 'tickets',
      recordId: updated.id,
      newValues: { position: updated.position },
    });

    return updated;
  }

  async markReady(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    const ticket = await this.prisma.withTenant(orgId, async (tx) => {
      await deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface);
      const current = await tx.ticket.findUnique({
        where: { id: ticketId, orgId },
        select: {
          id: true,
          queueId: true,
          status: true,
          readyAt: true,
          branchId: true,
          displayNumber: true,
          customerPhone: true,
        },
      });
      if (!current) throw new NotFoundException('Ticket not found');
      if (current.status !== 'waiting') {
        throw new BadRequestException('Only waiting tickets can be marked ready');
      }

      const callingPolicy = await deps.resolveQueueCallingPolicy(tx, orgId, current.queueId);
      const queue = await tx.queue.findUnique({
        where: { id: current.queueId, orgId },
        select: { id: true, branchId: true },
      });
      if (!queue) throw new NotFoundException('Queue not found');
      await this.staffGuards.assertStaffQueueActionAllowed(
        tx,
        orgId,
        current.queueId,
        queue.branchId,
        'marking tickets ready',
        'customer_intake',
      );
      if (!deps.isReadyGatedPolicy(callingPolicy)) {
        throw new BadRequestException('This queue does not use readiness gating');
      }
      if (actionSurface === 'classic') {
        await this.staffGuards.assertClassicDeskAssignmentForBranch(
          tx,
          orgId,
          userId,
          current.branchId,
        );
      }

      return tx.ticket.update({
        where: { id: ticketId },
        data: { readyAt: current.readyAt ?? new Date() },
        include: {
          queue: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
      });
    });

    this.ticketRealtime.publishMany([
      { channel: `queue:${ticket.queueId}`, event: 'ticket.ready', data: ticket },
      { channel: `display:${ticket.branchId}`, event: 'ticket.ready', data: ticket },
      { channel: `org:${orgId}`, event: 'ticket.ready', data: ticket },
    ]);
    deps.invalidateDerivedStats(orgId, ticket.branchId, [ticket.queueId]).catch(() => {});
    await this.audit.logActivity({
      orgId,
      userId,
      action: 'ticket.mark_ready',
      resourceType: 'ticket',
      resourceId: ticket.id,
      metadata: { queueId: ticket.queueId },
    });

    return ticket;
  }

  async serve(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    const current = await this.prisma.withTenant(orgId, async (tx) => {
      await deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface);
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, orgId },
        select: {
          status: true,
          branchId: true,
          deskNumber: true,
          metadata: true,
        },
      });
      if (ticket && actionSurface === 'classic') {
        await this.staffGuards.assertClassicDeskAssignmentForBranch(
          tx,
          orgId,
          userId,
          ticket.branchId,
          {
            requiredDeskNumber: ticket.deskNumber,
          },
        );
      }
      return ticket;
    });
    if (!current) throw new NotFoundException('Ticket not found');
    // Idempotent: duplicate "Start serving" clicks (or stale UI) should not surface as errors.
    if (current.status === 'serving') {
      return this.prisma.withTenant(orgId, (tx) =>
        tx.ticket.findFirst({
          where: { id: ticketId, orgId },
          include: {
            queue: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        }),
      );
    }

    const resummonSmsOnServe = deps.ticketMetadataFlag(
      current.metadata,
      METADATA_RESUMMON_SMS_ON_SERVE,
    );

    const ticket = await deps.transitionTicket(orgId, ticketId, 'called', 'serving', {
      servedAt: new Date(),
      servedByUserId: userId,
      ...(resummonSmsOnServe
        ? {
            metadata: deps.clearTicketMetadataFlag(
              current.metadata,
              METADATA_RESUMMON_SMS_ON_SERVE,
            ),
          }
        : {}),
    });

    if (resummonSmsOnServe) {
      const notifyTicket = await this.prisma.withTenant(orgId, (tx) =>
        tx.ticket.findFirst({
          where: { id: ticketId, orgId },
          select: {
            id: true,
            displayNumber: true,
            deskNumber: true,
            customerPhone: true,
            transactionalSmsAllowed: true,
            queue: { select: { name: true } },
          },
        }),
      );
      if (notifyTicket && deps.canSendTransactionalSms(notifyTicket)) {
        deps.emitTicketCalledNotification(orgId, notifyTicket);
      }
    }

    return ticket;
  }

  private async findTicketForActionResponse(
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

  private async findActiveJourneyFollowUpTicket(
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

  async complete(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    userId: string,
    externalRef?: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    deps.stampRequestContext(orgId, { ticketId });
    await this.prisma.withTenant(orgId, (tx) =>
      deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface),
    );
    if (actionSurface === 'classic') {
      await this.prisma.withTenant(orgId, async (tx) => {
        const ticket = await tx.ticket.findFirst({
          where: { id: ticketId, orgId },
          select: { branchId: true, deskNumber: true },
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        await this.staffGuards.assertClassicDeskAssignmentForBranch(
          tx,
          orgId,
          userId,
          ticket.branchId,
          {
            requiredDeskNumber: ticket.deskNumber,
          },
        );
      });
    }
    return deps.finalizeTicketWithJourneyAdvance(orgId, ticketId, 'completed', externalRef);
  }

  async noShow(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    await this.prisma.withTenant(orgId, (tx) =>
      deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface),
    );
    const current = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.findFirst({
        where: { id: ticketId, orgId },
        select: { status: true },
      }),
    );
    if (!current) throw new NotFoundException('Ticket not found');
    if (actionSurface === 'classic') {
      await this.prisma.withTenant(orgId, async (tx) => {
        const assignmentContext = await tx.ticket.findFirst({
          where: { id: ticketId, orgId },
          select: { branchId: true, deskNumber: true },
        });
        if (!assignmentContext) throw new NotFoundException('Ticket not found');
        await this.staffGuards.assertClassicDeskAssignmentForBranch(
          tx,
          orgId,
          userId,
          assignmentContext.branchId,
          {
            requiredDeskNumber: assignmentContext.deskNumber,
          },
        );
      });
    }
    if (current.status === 'no_show') {
      return this.findTicketForActionResponse(this.prisma, orgId, ticketId);
    }
    if (current.status === 'completed') {
      const journey = await this.prisma.withTenant(orgId, (tx) =>
        tx.ticket.findUnique({
          where: { id: ticketId },
          select: { visitId: true, stepIndex: true },
        }),
      );
      const ticket = await this.findTicketForActionResponse(this.prisma, orgId, ticketId);
      const nextTicket = await this.findActiveJourneyFollowUpTicket(
        this.prisma,
        orgId,
        ticketId,
        journey?.visitId ?? null,
        journey?.stepIndex ?? null,
      );
      return nextTicket ? { ticket, nextTicket } : ticket;
    }
    const ticket = await this.prisma.withTenant(orgId, async (tx) =>
      deps.transitionTicketCore(tx, orgId, ticketId, ['called', 'serving'], 'no_show', {
        completedAt: new Date(),
      }),
    );
    deps.emitTransitionSideEffects(orgId, ticket, ticketId, 'no_show');
    return ticket;
  }

  async cancel(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    actorUserId?: string,
    reason?: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    deps.stampRequestContext(orgId, { ticketId });
    const ticket = await this.prisma.withTenant(orgId, async (tx) => {
      await deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface);
      const [current] = await tx.$queryRaw<
        Array<{
          status: string;
          queueId: string;
          note: string | null;
          branchId: string;
          visitId: string | null;
          deskNumber: string | null;
        }>
      >(Prisma.sql`
        SELECT 
          status, 
          queue_id AS "queueId", 
          note, 
          branch_id AS "branchId", 
          visit_id AS "visitId", 
          desk_number AS "deskNumber"
        FROM tickets 
        WHERE id = ${ticketId}::uuid AND org_id = ${orgId}::uuid 
        FOR UPDATE
      `);

      if (!current) throw new NotFoundException('Ticket not found');
      if (actionSurface === 'classic' && actorUserId) {
        await this.staffGuards.assertClassicDeskAssignmentForBranch(
          tx,
          orgId,
          actorUserId,
          current.branchId,
          {
            requiredDeskNumber: current.deskNumber,
          },
        );
      }
      await this.staffGuards.assertStaffQueueActionAllowed(
        tx,
        orgId,
        current.queueId,
        current.branchId,
        'cancelling tickets',
        'queue_status_only',
      );
      if (current.status !== 'waiting' && current.status !== 'called') {
        throw new BadRequestException(`Cannot cancel ticket in status: ${current.status}`);
      }

      return tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          note: current.note ? `${current.note} | Cancelled: ${reason}` : `Cancelled: ${reason}`,
        },
        include: { queue: { select: { id: true, name: true } } },
      });
    });

    deps.stampRequestContext(orgId, { ticketId, queueId: ticket.queueId });

    this.ticketRealtime.publishMany([
      { channel: `queue:${ticket.queueId}`, event: 'ticket.cancelled', data: ticket },
      { channel: `org:${orgId}`, event: 'ticket.cancelled', data: ticket },
    ]);
    deps.invalidateDerivedStats(orgId, ticket.branchId, [ticket.queueId]).catch(() => {});
    this.ticketTransition.refreshVisitStatus(orgId, ticket.visitId).catch(() => {});
    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'ticket.cancel',
      resourceType: 'ticket',
      resourceId: ticket.id,
      metadata: {
        queueId: ticket.queueId,
        status: ticket.status,
        reason: reason ?? null,
      },
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'update',
      tableName: 'tickets',
      recordId: ticket.id,
      newValues: { status: ticket.status, completedAt: ticket.completedAt?.toISOString() ?? null },
    });
    return ticket;
  }

  /**
   * Transfer a ticket to another queue.
   * @param targetDeskNumber  When provided the ticket is transferred AND immediately
   *                          called at the given desk in the target queue (mode 3).
   *                          When omitted the ticket goes back to 'waiting' with no desk (mode 1).
   */
  async transfer(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    targetQueueId: string | undefined,
    actorUserId: string,
    targetDeskNumber?: string,
    externalRef?: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    const updated = await this.prisma.withTenant(orgId, async (tx) => {
      await deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface);
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId, orgId },
        include: { visit: true, queue: { select: { flowTemplateId: true, stepRole: true } } },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (actionSurface === 'classic') {
        await this.staffGuards.assertClassicDeskAssignmentForBranch(
          tx,
          orgId,
          actorUserId,
          ticket.branchId,
          {
            requiredDeskNumber: ticket.deskNumber,
          },
        );
      }

      await this.staffGuards.assertStaffQueueActionAllowed(
        tx,
        orgId,
        ticket.queueId,
        ticket.branchId,
        'transferring tickets',
        'customer_intake',
      );

      let resolvedTargetQueueId = targetQueueId;
      let resolvedStepIndex: number | null = null;
      if (ticket.visitId) {
        const flowTemplateId =
          ticket.queue.flowTemplateId ??
          (
            await tx.branchFlowTemplate.findFirst({
              where: { orgId, branchId: ticket.branchId, isActive: true },
              select: { id: true },
            })
          )?.id;
        if (flowTemplateId) {
          const steps = await tx.branchFlowStep.findMany({
            where: { orgId, templateId: flowTemplateId },
            orderBy: { stepIndex: 'asc' },
            select: { queueId: true, stepIndex: true },
          });
          const currentStepIndex =
            ticket.stepIndex ??
            steps.find((step) => step.queueId === ticket.queueId)?.stepIndex ??
            0;
          const nextStep = steps.find((step) => step.stepIndex > currentStepIndex);
          if (nextStep) {
            resolvedStepIndex = nextStep.stepIndex;
            if (resolvedTargetQueueId && resolvedTargetQueueId !== nextStep.queueId) {
              throw new BadRequestException(
                'Target queue must match the next step in the active flow template',
              );
            }
            resolvedTargetQueueId = resolvedTargetQueueId ?? (nextStep.queueId || undefined);
          }
        }
      }
      if (!resolvedTargetQueueId) {
        throw new BadRequestException('Target queue is required');
      }
      const targetQueue = await tx.queue.findUnique({
        where: { id: resolvedTargetQueueId, orgId },
        select: { id: true, serviceId: true, stepRole: true },
      });
      if (!targetQueue) throw new NotFoundException('Target queue not found');
      const targetCallingPolicy = await deps.resolveQueueCallingPolicy(
        tx,
        orgId,
        resolvedTargetQueueId,
      );

      const { displayNumber: newDisplayNumber } = await deps.reserveQueueDisplayNumber(
        tx,
        orgId,
        resolvedTargetQueueId,
        {
          enforceOpenForNonStaff: true,
        },
      );

      const isQueueDeskTransfer = !!targetDeskNumber;

      const sourceAcceptsRef = journeyStepAcceptsExternalRef(
        ticket.stepIndex,
        ticket.queue.stepRole,
      );
      const targetAcceptsRef = journeyStepAcceptsExternalRef(
        resolvedStepIndex,
        targetQueue.stepRole,
      );

      let resolvedExternalRef: string | null = null;
      if (ticket.visitId && targetAcceptsRef) {
        if (externalRef?.trim()) {
          resolvedExternalRef = await this.journeyFlow.resolveVisitExternalRef(
            tx,
            orgId,
            ticket.visitId,
            externalRef,
          );
        } else if (sourceAcceptsRef) {
          resolvedExternalRef = await this.journeyFlow.resolveVisitExternalRef(
            tx,
            orgId,
            ticket.visitId,
            ticket.externalRef,
          );
        }
      }
      if (ticket.visitId && sourceAcceptsRef && !resolvedExternalRef) {
        throw new BadRequestException(
          'Transaction number is required from the first step and must be carried through the journey.',
        );
      }

      let updated: any;

      if (ticket.visitId) {
        // MULTI-STEP JOURNEY: Create a new ticket and complete the old one
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            ...(resolvedExternalRef ? { externalRef: resolvedExternalRef } : {}),
          },
        });

        updated = await tx.ticket.create({
          data: {
            orgId,
            branchId: ticket.branchId,
            visitId: ticket.visitId,
            queueId: resolvedTargetQueueId,
            serviceId: targetQueue.serviceId ?? '',
            customerId: ticket.customerId,
            customerName: ticket.customerName,
            customerPhone: ticket.customerPhone,
            transactionalSmsAllowed: ticket.transactionalSmsAllowed,
            displayNumber: newDisplayNumber,
            status: isQueueDeskTransfer ? 'called' : 'waiting',
            priority: ticket.priority,
            source: ticket.source,
            language: ticket.language,
            note: ticket.note,
            ...(resolvedExternalRef ? { externalRef: resolvedExternalRef } : {}),
            stepIndex:
              resolvedStepIndex ?? (ticket.stepIndex != null ? ticket.stepIndex + 1 : null),
            readyAt: deps.isReadyGatedPolicy(targetCallingPolicy) ? null : null,
            bookedAt: new Date(),
            calledAt: isQueueDeskTransfer ? new Date() : null,
            deskNumber: targetDeskNumber ?? null,
          },
          include: {
            queue: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        });
      } else {
        // SINGLE TICKET: Just update the existing ticket
        updated = await tx.ticket.update({
          where: { id: ticketId },
          data: {
            queueId: resolvedTargetQueueId,
            stepIndex: resolvedStepIndex ?? ticket.stepIndex ?? null,
            readyAt: deps.isReadyGatedPolicy(targetCallingPolicy) ? null : null,
            displayNumber: newDisplayNumber,
            status: isQueueDeskTransfer ? 'called' : 'waiting',
            calledAt: isQueueDeskTransfer ? new Date() : null,
            servedAt: null,
            servedByUserId: null,
            deskNumber: targetDeskNumber ?? null,
            ...(resolvedExternalRef ? { externalRef: resolvedExternalRef } : {}),
          },
          include: {
            queue: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
          },
        });
      }

      setTimeout(() => {
        this.ticketRealtime.publishMany([
          { channel: `queue:${ticket.queueId}`, event: 'ticket.transferred_out', data: updated },
          {
            channel: `queue:${resolvedTargetQueueId}`,
            event: 'ticket.transferred_in',
            data: updated,
          },
          { channel: `org:${orgId}`, event: 'ticket.transferred', data: updated },
        ]);
        deps
          .invalidateDerivedStats(orgId, ticket.branchId, [ticket.queueId, resolvedTargetQueueId])
          .catch(() => {});
        if (ticket.visitId) {
          this.ticketTransition.refreshVisitStatus(orgId, ticket.visitId).catch(() => {});
        }
      }, 0);

      return updated;
    });

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'ticket.transfer',
      resourceType: 'ticket',
      resourceId: updated.id,
      metadata: {
        targetQueueId: updated.queueId,
        targetDeskNumber: targetDeskNumber ?? null,
        status: updated.status,
      },
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'update',
      tableName: 'tickets',
      recordId: updated.id,
      newValues: {
        queueId: updated.queueId,
        deskNumber: targetDeskNumber ?? null,
        status: updated.status,
      },
    });

    return updated;
  }

  async recall(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
    notifyDeskNumber?: string,
  ) {
    await this.prisma.withTenant(orgId, (tx) =>
      deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface),
    );
    const existingTicket = await this.prisma.withTenant(orgId, async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId, orgId },
        select: { status: true, branchId: true, deskNumber: true, metadata: true },
      });
      if (ticket && actionSurface === 'classic') {
        await this.staffGuards.assertClassicDeskAssignmentForBranch(
          tx,
          orgId,
          userId,
          ticket.branchId,
          {
            requiredDeskNumber: ticket.deskNumber,
          },
        );
      }
      return ticket;
    });
    const isUndo = existingTicket?.status === 'serving';

    const recallData: Record<string, unknown> = { calledAt: new Date() };
    if (isUndo) {
      recallData.servedAt = null;
      recallData.servedByUserId = null;
      recallData.metadata = deps.mergeTicketMetadata(existingTicket?.metadata, {
        [METADATA_RESUMMON_SMS_ON_SERVE]: true,
      });
    } else if (deps.ticketMetadataFlag(existingTicket?.metadata, METADATA_RESUMMON_SMS_ON_SERVE)) {
      // Re-call from called already sends "your turn"; do not send again on next serve.
      recallData.metadata = deps.clearTicketMetadataFlag(
        existingTicket?.metadata,
        METADATA_RESUMMON_SMS_ON_SERVE,
      );
    }
    if (notifyDeskNumber) {
      recallData.deskNumber = notifyDeskNumber;
    }

    const ticket = await deps.transitionTicket(
      orgId,
      ticketId,
      ['called', 'serving'],
      'called',
      recallData,
    );

    if (ticket && deps.canSendTransactionalSms(ticket)) {
      const smsDesk = (ticket.deskNumber ?? notifyDeskNumber) || undefined;
      const smsOpts = {
        displayNumber: ticket.displayNumber ?? undefined,
        deskNumber: smsDesk,
        customerPhone: ticket.customerPhone,
        queueName: ticket.queue?.name,
        transactionalSmsAllowed: ticket.transactionalSmsAllowed,
      };

      if (isUndo) {
        deps
          .notifyTicketRecalled(orgId, ticket.id, { ...smsOpts, isUndo: true })
          .catch((error: Error) =>
            this.logger.warn(
              `SMS notification failed for ticket recall ${ticket.id}: ${error.message}`,
            ),
          );
      } else {
        deps.emitTicketCalledNotification(orgId, ticket, smsDesk);
      }
    }

    return ticket;
  }

  /**
   * Reassigns an active ticket to a different desk (same queue).
   * Updates deskNumber and emits a real-time event so lobby displays refresh.
   */
  async changeDesk(
    deps: TicketStaffActionDeps,
    orgId: string,
    ticketId: string,
    targetDeskNumber: string,
    userId: string,
    actionSurface: ActionSurface = 'classic',
  ) {
    await this.prisma.withTenant(orgId, (tx) =>
      deps.assertActionSurfaceForTicket(tx, orgId, ticketId, actionSurface),
    );
    let oldDeskNumber: string | null = null;
    const updated = await this.prisma.withTenant(orgId, async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId, orgId },
        select: {
          id: true,
          queueId: true,
          status: true,
          displayNumber: true,
          deskNumber: true,
          branchId: true,
        },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (actionSurface === 'classic') {
        await this.staffGuards.assertClassicDeskAssignmentForBranch(
          tx,
          orgId,
          userId,
          ticket.branchId,
          {
            requiredDeskNumber: ticket.deskNumber,
          },
        );
      }
      oldDeskNumber = ticket.deskNumber;
      await this.staffGuards.assertStaffQueueActionAllowed(
        tx,
        orgId,
        ticket.queueId,
        ticket.branchId,
        'changing desk assignments',
        'queue_status_only',
      );
      if (!['called', 'serving'].includes(ticket.status)) {
        throw new BadRequestException(
          'Only active (called/serving) tickets can be reassigned to another desk',
        );
      }

      return tx.ticket.update({
        where: { id: ticketId },
        data: { deskNumber: targetDeskNumber },
        include: { queue: { select: { id: true, name: true } } },
      });
    });

    setTimeout(() => {
      this.ticketRealtime.publishMany([
        {
          channel: `queue:${updated.queueId}`,
          event: 'ticket.desk_changed',
          data: { ...updated, changedByUserId: userId },
        },
        {
          channel: `org:${orgId}`,
          event: 'ticket.desk_changed',
          data: { ...updated, changedByUserId: userId },
        },
      ]);
    }, 0);

    await this.audit.logActivity({
      orgId,
      userId,
      action: 'ticket.change_desk',
      resourceType: 'ticket',
      resourceId: ticketId,
      metadata: { targetDeskNumber },
    });
    await this.audit.logAudit({
      orgId,
      userId,
      action: 'update',
      tableName: 'tickets',
      recordId: ticketId,
      oldValues: { deskNumber: oldDeskNumber ?? null },
      newValues: { deskNumber: targetDeskNumber },
    });

    return updated;
  }
}
