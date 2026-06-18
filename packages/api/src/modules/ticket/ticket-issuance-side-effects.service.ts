import { Injectable, Logger } from '@nestjs/common';
import { TicketRealtimeService } from './ticket-realtime.service';
import { TicketStatsCacheService } from './ticket-stats-cache.service';
import { canSendTransactionalSms } from './ticket-notification.util';

@Injectable()
export class TicketIssuanceSideEffectsService {
  private readonly logger = new Logger(TicketIssuanceSideEffectsService.name);

  constructor(
    private readonly ticketRealtime: TicketRealtimeService,
    private readonly statsCache: TicketStatsCacheService,
  ) {}

  emitTicketIssuedSideEffects(
    orgId: string,
    ticket: {
      id: string;
      visitId?: string | null;
      displayNumber?: string | null;
      customerPhone?: string | null;
      transactionalSmsAllowed?: boolean | null;
      service?: { name?: string | null } | null;
    },
    queueId: string,
    branchId: string,
    notifyTicketIssued: (
      orgId: string,
      opts: {
        ticketId: string;
        displayNumber?: string | null;
        customerPhone?: string | undefined;
        serviceName?: string | null;
        transactionalSmsAllowed?: boolean;
      },
    ) => Promise<unknown>,
  ): void {
    this.statsCache.incrementMonthlyTicketCount(orgId).catch(() => {});
    this.ticketRealtime.publishMany([
      { channel: `queue:${queueId}`, event: 'ticket.issued', data: ticket },
      { channel: `display:${branchId}`, event: 'ticket.issued', data: ticket },
      { channel: `org:${orgId}`, event: 'ticket.issued', data: ticket },
    ]);
    this.statsCache.invalidateDerivedStats(orgId, branchId, [queueId]).catch(() => {});

    if (!ticket.visitId && canSendTransactionalSms(ticket)) {
      notifyTicketIssued(orgId, {
        ticketId: ticket.id,
        displayNumber: ticket.displayNumber,
        customerPhone: ticket.customerPhone ?? undefined,
        serviceName: ticket.service?.name,
        transactionalSmsAllowed: ticket.transactionalSmsAllowed ?? undefined,
      }).catch((error: Error) =>
        this.logger.error(
          `Ticket issued SMS/email pipeline failed for ${ticket.id}: ${error.message}`,
        ),
      );
    }
  }
}
