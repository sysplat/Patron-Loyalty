import { Injectable, Logger, MessageEvent, NotFoundException } from '@nestjs/common';
import { Observable, defer, from, switchMap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisPubSubManager } from '../../redis/redis-pubsub-manager.service';

/**
 * Server-Sent Events stream for `/tickets/:id/track/stream`.
 * Subscribes to Redis `track:queue:{queueId}` — published whenever ticket actions fan out real-time updates.
 */
@Injectable()
export class TicketTrackSseService {
  private readonly logger = new Logger(TicketTrackSseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pubSubManager: RedisPubSubManager,
  ) {}

  observeTicketStream(ticketId: string): Observable<MessageEvent> {
    return defer(() =>
      from(
        this.prisma.withBypassRls(async (tx) => {
          const row = await tx.ticket.findUnique({
            where: { id: ticketId },
            select: { queueId: true },
          });
          if (!row) throw new NotFoundException('Ticket not found');
          return row.queueId;
        }),
      ),
    ).pipe(switchMap((queueId) => this.observeQueueChannel(queueId)));
  }

  private observeQueueChannel(queueId: string): Observable<MessageEvent> {
    const channel = `track:queue:${queueId}`;

    return new Observable<MessageEvent>((observer) => {
      let heartbeat: NodeJS.Timeout | undefined;
      let unsubscribeFn: (() => void) | null = null;

      this.pubSubManager
        .subscribe(channel, (message) => {
          observer.next({ data: message });
        })
        .then((unsub) => {
          unsubscribeFn = unsub;
          observer.next({ data: JSON.stringify({ type: 'connected', queueId }) });

          heartbeat = setInterval(() => {
            observer.next({ data: JSON.stringify({ type: 'ping' }) });
          }, 25000);
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `track SSE subscribe failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          observer.error(err);
        });

      return () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribeFn) unsubscribeFn();
      };
    });
  }
}
