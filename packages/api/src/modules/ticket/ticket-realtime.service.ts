import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EffectiveTimezoneContext } from '../../common/resolve-effective-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { ticketWaitingOrderBy } from './ticket-query.service';

@Injectable()
export class TicketRealtimeService {
  private static readonly MAX_ALMOST_READY_SMS_RECIPIENTS = 3;

  private readonly logger = new Logger(TicketRealtimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  async publishEvent(channel: string, event: string, data: unknown): Promise<void> {
    return this.publishMany([{ channel, event, data }]);
  }

  /**
   * Sends every queued real-time event in ONE Centrifugo HTTP round-trip via the
   * documented `/api/batch` endpoint (https://centrifugal.dev/docs/server/server_api#batch).
   */
  async publishMany(events: Array<{ channel: string; event: string; data: unknown }>) {
    if (events.length === 0) return;

    const trackQueueIds: string[] = [];
    const trackVisitIds: string[] = [];
    for (const e of events) {
      if (e.channel.startsWith('queue:')) {
        trackQueueIds.push(e.channel.slice('queue:'.length));
      }
      const visitId =
        e.data && typeof e.data === 'object' && 'visitId' in e.data
          ? (e.data as { visitId?: unknown }).visitId
          : null;
      if (typeof visitId === 'string' && visitId.trim()) {
        trackVisitIds.push(visitId.trim());
      }
    }
    if (trackQueueIds.length > 0) {
      this.redis.publishTrackQueues(trackQueueIds).catch((err: unknown) => {
        this.logger.warn(
          `Redis track SSE notify failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
    const uniqVisitIds = [...new Set(trackVisitIds)];
    if (uniqVisitIds.length > 0) {
      this.redis.publishTrackVisits(uniqVisitIds).catch((err: unknown) => {
        this.logger.warn(
          `Redis visit track SSE notify failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    const apiUrl = this.config.get<string>('app.centrifugo.apiUrl');
    const apiKey = this.config.get<string>('app.centrifugo.apiKey');
    if (!apiUrl || !apiKey) return;

    const requestId = this.requestContext.getRequestId();

    const commands: Array<{ publish: { channel: string; data: unknown } }> = [];
    for (const e of events) {
      const envelopeData = requestId
        ? { event: e.event, data: e.data, requestId }
        : { event: e.event, data: e.data };
      commands.push({
        publish: {
          channel: e.channel,
          data: envelopeData,
        },
      });

      if (e.channel.startsWith('queue:') && e.event !== 'queue.updated') {
        const updateData = requestId
          ? { event: 'queue.updated', data: { sourceEvent: e.event }, requestId }
          : { event: 'queue.updated', data: { sourceEvent: e.event } };
        commands.push({
          publish: {
            channel: e.channel,
            data: updateData,
          },
        });
      }
    }

    const batchUrl = apiUrl.endsWith('/batch') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/batch`;

    try {
      await fetch(batchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `apikey ${apiKey}`,
        },
        body: JSON.stringify({ commands, parallel: true }),
        signal: AbortSignal.timeout(4000),
      });
    } catch (err: unknown) {
      this.logger.warn(
        `Centrifugo batch publish failed (${commands.length} cmds): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * After the next customer is called, optionally SMS the first few waiting customers with a phone on file.
   */
  async notifyAlmostReadyTickets(
    orgId: string,
    queueId: string,
    deps: {
      liveQueueBookedAtFloor: (orgId: string, context?: EffectiveTimezoneContext) => Promise<Date>;
      notifyAlmostReady: (
        orgId: string,
        ticketId: string,
        position: number,
        customerPhone?: string,
        opts?: { servingDeskNumber?: string | null; queueName?: string | null },
      ) => Promise<void>;
    },
  ): Promise<void> {
    const configured = Number.parseInt(
      this.config.get<string>('TICKET_ALMOST_READY_POSITION', '3'),
      10,
    );
    if (!Number.isFinite(configured) || configured < 1) return;

    const take = Math.min(TicketRealtimeService.MAX_ALMOST_READY_SMS_RECIPIENTS, configured);
    const bookedAtFloor = await deps.liveQueueBookedAtFloor(orgId, { queueId });

    const waiting = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.findMany({
        where: {
          orgId,
          queueId,
          status: 'waiting',
          bookedAt: { gte: bookedAtFloor },
          customerPhone: { not: null },
          transactionalSmsAllowed: true,
        },
        orderBy: ticketWaitingOrderBy(),
        take,
        select: {
          id: true,
          displayNumber: true,
          customerPhone: true,
          queue: { select: { name: true } },
        },
      }),
    );

    if (waiting.length === 0) return;

    const queueMeta = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.findUnique({ where: { id: queueId }, select: { branchId: true, name: true } }),
    );
    const flowStep =
      queueMeta?.branchId != null
        ? await this.prisma.withTenant(orgId, (tx) =>
            tx.branchFlowStep.findFirst({
              where: {
                orgId,
                queueId,
                template: { branchId: queueMeta.branchId, isActive: true },
              },
              select: { deskNumber: true },
            }),
          )
        : null;
    const servingDeskNumber = flowStep?.deskNumber?.trim() || null;
    const queueName = queueMeta?.name ?? null;

    for (let i = 0; i < waiting.length; i++) {
      const ticket = waiting[i];
      const position = i + 1;

      const lockKey = `notif:almost-ready:${ticket.id}:${position}`;
      const exists = await this.redis.get(lockKey);
      if (exists) continue;

      deps
        .notifyAlmostReady(orgId, ticket.id, position, ticket.customerPhone ?? undefined, {
          servingDeskNumber,
          queueName,
        })
        .catch((error: Error) =>
          this.logger.warn(
            `Almost-ready SMS failed for ticket ${ticket.id} at pos ${position}: ${error.message}`,
          ),
        );

      await this.redis.set(lockKey, '1', 86400);
    }
  }
}
