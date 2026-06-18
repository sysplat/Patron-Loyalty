import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { TICKET_ERROR_CODES, LOYALTY_EVENTS } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { TicketStaffGuardService } from './ticket-staff-guard.service';
import type { BranchOperationalGate } from '../branch/branch-hours.service';
import { TicketJourneyFlowService } from './ticket-journey-flow.service';
import { TicketRealtimeService } from './ticket-realtime.service';
import { LoyaltyTicketCompletedEvent, LoyaltyTicketNoShowEvent } from '../loyalty/loyalty.events';

export type TicketTransitionSideEffects = {
  invalidateDerivedStats: (orgId: string, branchId: string, queueIds: string[]) => Promise<void>;
};

@Injectable()
export class TicketTransitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly staffGuards: TicketStaffGuardService,
    private readonly journeyFlow: TicketJourneyFlowService,
    private readonly realtime: TicketRealtimeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async transitionTicketCore(
    tx: Prisma.TransactionClient,
    orgId: string,
    ticketId: string,
    fromStatus: string | string[],
    toStatus: string,
    extraData: Record<string, unknown>,
  ) {
    const [current] = await tx.$queryRaw<
      Array<{
        status: string;
        queueId: string;
        branchId: string;
        orgId: string;
        bookedAt: Date;
        servedAt: Date | null;
        calledAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT 
        status, 
        queue_id AS "queueId", 
        branch_id AS "branchId", 
        org_id AS "orgId", 
        booked_at AS "bookedAt", 
        served_at AS "servedAt", 
        called_at AS "calledAt"
      FROM tickets 
      WHERE id = ${ticketId}::uuid AND org_id = ${orgId}::uuid 
      FOR UPDATE
    `);

    if (!current) throw new NotFoundException('Ticket not found');
    await this.staffGuards.assertStaffQueueActionAllowed(
      tx,
      orgId,
      current.queueId,
      current.branchId,
      `marking tickets as ${toStatus}`,
      this.branchHoursGateForTransition(current.status, toStatus),
    );

    const allowed = Array.isArray(fromStatus) ? fromStatus : [fromStatus];
    if (!allowed.includes(current.status)) {
      throw new BadRequestException({
        code: TICKET_ERROR_CODES.INVALID_TRANSITION,
        message: `Ticket is in ${current.status} state, expected ${allowed.join(' or ')}`,
        details: {
          currentStatus: current.status,
          allowedStatuses: allowed,
          targetStatus: toStatus,
        },
      });
    }

    const dataToUpdate: Prisma.TicketUpdateInput = {
      status: toStatus,
      ...(extraData as Prisma.TicketUpdateInput),
    };

    if (current.status === 'waiting' && toStatus !== 'waiting') {
      dataToUpdate.position = null;
    }

    if (toStatus === 'completed' || toStatus === 'no_show') {
      const now = new Date();
      const bookedAt = new Date(current.bookedAt);
      const servedAtValue = dataToUpdate.servedAt;
      const effectiveServedAt = servedAtValue
        ? new Date(servedAtValue as string | Date)
        : current.servedAt
          ? new Date(current.servedAt)
          : current.calledAt
            ? new Date(current.calledAt)
            : now;

      dataToUpdate.waitMinutes = Math.round(
        Math.max(0, (effectiveServedAt.getTime() - bookedAt.getTime()) / 60000),
      );
      dataToUpdate.serviceMinutes = Math.round(
        Math.max(0, (now.getTime() - effectiveServedAt.getTime()) / 60000),
      );
    }

    return tx.ticket.update({
      where: { id: ticketId },
      data: dataToUpdate,
      include: {
        queue: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    });
  }

  emitTransitionSideEffects(
    orgId: string,
    ticket: { queueId: string; branchId: string; orgId: string; visitId?: string | null },
    ticketId: string,
    toStatus: string,
    sideEffects: TicketTransitionSideEffects,
  ) {
    const eventName = `ticket.${toStatus}`;
    this.realtime.publishMany([
      { channel: `queue:${ticket.queueId}`, event: eventName, data: ticket },
      { channel: `display:${ticket.branchId}`, event: eventName, data: ticket },
      { channel: `org:${ticket.orgId}`, event: eventName, data: ticket },
    ]);

    sideEffects.invalidateDerivedStats(orgId, ticket.branchId, [ticket.queueId]).catch(() => {});
    this.redis.del(`cache:ticket-public:${ticketId}`).catch(() => {});
    this.refreshVisitStatus(ticket.orgId, ticket.visitId).catch(() => {});
  }

  async transitionTicket(
    orgId: string,
    ticketId: string,
    fromStatus: string | string[],
    toStatus: string,
    extraData: Record<string, unknown>,
    sideEffects: TicketTransitionSideEffects,
  ) {
    const ticket = await this.prisma.withTenant(orgId, async (tx) =>
      this.transitionTicketCore(tx, orgId, ticketId, fromStatus, toStatus, extraData),
    );

    this.emitTransitionSideEffects(orgId, ticket, ticketId, toStatus, sideEffects);

    if (toStatus === 'completed') {
      this.eventEmitter.emit(
        LOYALTY_EVENTS.TICKET_COMPLETED,
        new LoyaltyTicketCompletedEvent(
          orgId,
          ticketId,
          (ticket as { customerId?: string | null }).customerId ?? null,
          ticket.branchId,
          (ticket as { serviceId?: string }).serviceId ?? ticket.service?.id ?? null,
        ),
      );
    }

    if (toStatus === 'no_show') {
      this.eventEmitter.emit(
        LOYALTY_EVENTS.TICKET_NO_SHOW,
        new LoyaltyTicketNoShowEvent(
          orgId,
          ticketId,
          (ticket as { customerId?: string | null }).customerId ?? null,
          ticket.branchId,
        ),
      );
    }

    return ticket;
  }

  async refreshVisitStatus(orgId: string, visitId?: string | null): Promise<void> {
    if (!visitId) return;

    await this.prisma.withTenant(orgId, async (tx) => {
      const [lockedVisit] = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM visits WHERE id = ${visitId}::uuid AND org_id = ${orgId}::uuid FOR UPDATE`,
      );
      if (!lockedVisit) return;

      const activeCount = await tx.ticket.count({
        where: {
          orgId,
          visitId,
          status: { in: ['waiting', 'called', 'serving'] },
        },
      });

      if (activeCount > 0) {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'active', completedAt: null },
        });
        return;
      }

      const lastTicket = await tx.ticket.findFirst({
        where: { orgId, visitId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          visitId: true,
          branchId: true,
          queueId: true,
          stepIndex: true,
          status: true,
          customerId: true,
          customerName: true,
          customerPhone: true,
          language: true,
          externalRef: true,
          deskNumber: true,
          flowTemplateId: true,
        },
      });

      if (lastTicket?.visitId) {
        const isAbandoned = lastTicket.status === 'no_show' || lastTicket.status === 'cancelled';
        if (!isAbandoned) {
          const nextStep = await this.journeyFlow.resolveNextJourneyStep(orgId, lastTicket);
          if (nextStep) {
            await tx.visit.update({
              where: { id: visitId },
              data: { status: 'active', completedAt: null },
            });
            return;
          }
        }
      }

      const visitExternalRef = lastTicket?.visitId
        ? await this.journeyFlow.resolveVisitExternalRef(tx, orgId, visitId, lastTicket.externalRef)
        : null;

      await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          ...(visitExternalRef ? { externalRef: visitExternalRef } : {}),
        },
      });
    });
  }

  private branchHoursGateForTransition(
    fromStatus: string,
    toStatus: string,
  ): BranchOperationalGate {
    if (toStatus === 'called') {
      return 'customer_intake';
    }
    if (toStatus === 'serving' && fromStatus === 'waiting') {
      return 'customer_intake';
    }
    return 'queue_status_only';
  }
}
