import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { TicketStaffGuardService } from './ticket-staff-guard.service';
import { TicketRealtimeService } from './ticket-realtime.service';
import { TicketStatsCacheService } from './ticket-stats-cache.service';

@Injectable()
export class TicketEstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly staffGuards: TicketStaffGuardService,
    private readonly ticketRealtime: TicketRealtimeService,
    private readonly statsCache: TicketStatsCacheService,
  ) {}

  async updateEstimates(
    orgId: string,
    ticketId: string,
    data: { estimatedRemainingMins?: number | null },
  ) {
    const updated = await this.prisma.withTenant(orgId, async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, orgId: true, branchId: true, queueId: true, status: true },
      });

      if (!ticket || ticket.orgId !== orgId) throw new NotFoundException('Ticket not found');
      await this.staffGuards.assertQueueNotClosedForStaffActions(
        tx,
        orgId,
        ticket.queueId,
        'updating estimates',
      );
      if (ticket.status !== 'serving' && ticket.status !== 'called') {
        throw new BadRequestException(
          'Can only update estimates for tickets in called or serving status',
        );
      }

      return tx.ticket.update({
        where: { id: ticketId },
        data: {
          estimatedRemainingMins: data.estimatedRemainingMins,
        },
      });
    });

    await this.statsCache.invalidateDerivedStats(orgId, updated.branchId, [updated.queueId]);
    await this.redis.del(`cache:ticket-public:${ticketId}`);

    this.ticketRealtime.publishMany([
      {
        channel: `queue:${updated.queueId}`,
        event: 'ticket.estimates_updated',
        data: { ticketId: updated.id, estimatedRemainingMins: data.estimatedRemainingMins },
      },
      {
        channel: `org:${updated.orgId}`,
        event: 'ticket.estimates_updated',
        data: { ticketId: updated.id, estimatedRemainingMins: data.estimatedRemainingMins },
      },
    ]);

    return updated;
  }
}
