import { Injectable, Logger, MessageEvent, NotFoundException } from '@nestjs/common';
import { Observable, defer, from, switchMap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisPubSubManager } from '../../redis/redis-pubsub-manager.service';

/**
 * Server-Sent Events stream for `/visits/:id/track/stream`.
 * Subscribes to Redis `track:visit:{visitId}` — published when any ticket on the visit changes.
 */
@Injectable()
export class VisitTrackSseService {
  private readonly logger = new Logger(VisitTrackSseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pubSubManager: RedisPubSubManager,
  ) {}

  observeVisitStream(visitIdOrToken: string): Observable<MessageEvent> {
    return defer(() =>
      from(
        this.prisma.withBypassRls(async (tx) => {
          const row = await tx.visit.findFirst({
            where: {
              OR: [{ id: visitIdOrToken }, { trackingToken: visitIdOrToken }],
            },
            select: { id: true },
          });
          if (!row) throw new NotFoundException('Visit not found');
          return row.id;
        }),
      ),
    ).pipe(switchMap((visitId) => this.observeVisitChannel(visitId)));
  }

  private observeVisitChannel(visitId: string): Observable<MessageEvent> {
    const channel = `track:visit:${visitId}`;

    return new Observable<MessageEvent>((observer) => {
      let heartbeat: NodeJS.Timeout | undefined;
      let unsubscribeFn: (() => void) | null = null;

      this.pubSubManager
        .subscribe(channel, (message) => {
          observer.next({ data: message });
        })
        .then((unsub) => {
          unsubscribeFn = unsub;
          observer.next({ data: JSON.stringify({ type: 'connected', visitId }) });

          heartbeat = setInterval(() => {
            observer.next({ data: JSON.stringify({ type: 'ping' }) });
          }, 25000);
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `visit track SSE subscribe failed: ${err instanceof Error ? err.message : String(err)}`,
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
