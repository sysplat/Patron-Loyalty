import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const CLIENT_ERROR_WINDOW_SECONDS = 3600;
const CLIENT_ERROR_SPIKE_THRESHOLD = 10;

export type ConnectorIngestOutcome = 'ok' | 'idempotent' | 'skipped' | 'validation_error' | 'error';

export type ConnectorIngestLog = {
  orgId: string;
  route: string;
  event?: string;
  sourceId?: string;
  connectorVersion?: number;
  durationMs: number;
  outcome: ConnectorIngestOutcome;
  idempotent?: boolean;
  skippedReason?: string;
  httpStatus?: number;
  requestId?: string;
  idempotencyKey?: string;
  /** Already-redacted keys only — phones/emails/names must not appear. */
  redactedPayload?: Record<string, unknown> | null;
};

const SENSITIVE_KEY =
  /^(phone|email|name|to|body|subject|accessToken|apiKey|password|token|secret|authorization)$/i;

/** Keep structure for support without storing PII. */
export function redactConnectorPayload(input: unknown, depth = 0): Record<string, unknown> | null {
  if (input == null || depth > 3) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = redactConnectorPayload(value, depth + 1);
      if (nested) out[key] = nested;
      continue;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      out[key] =
        typeof value === 'string' && value.length > 120 ? `${value.slice(0, 117)}...` : value;
    }
  }
  return out;
}

@Injectable()
export class LoyaltyConnectorObservabilityService {
  private readonly logger = new Logger('LoyaltyConnector');

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  logIngest(entry: ConnectorIngestLog): void {
    this.logger.log(
      JSON.stringify({
        type: 'loyalty_connector_ingest',
        ...entry,
      }),
    );
  }

  /** Log + persist a redacted integration event for tenant Diagnostics. */
  async recordIngest(entry: ConnectorIngestLog): Promise<void> {
    const requestId = entry.requestId || this.requestContext.getRequestId();
    this.logIngest({ ...entry, requestId });

    try {
      await this.prisma.withTenant(entry.orgId, (tx) =>
        tx.loyaltyIntegrationEvent.create({
          data: {
            orgId: entry.orgId,
            route: entry.route.slice(0, 80),
            event: entry.event?.slice(0, 80),
            sourceId: entry.sourceId?.slice(0, 120),
            outcome: entry.outcome.slice(0, 30),
            httpStatus: entry.httpStatus,
            durationMs: entry.durationMs,
            requestId: requestId?.slice(0, 80),
            idempotencyKey: entry.idempotencyKey?.slice(0, 120),
            redactedPayload:
              entry.redactedPayload == null
                ? undefined
                : (entry.redactedPayload as Prisma.InputJsonValue),
          },
        }),
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Integration event persist failed (ignored): ${detail}`);
    }
  }

  /** Track repeated 4xx from the same org for ops alerting (best-effort Redis). */
  async recordClientError(orgId: string, route: string, statusCode: number): Promise<void> {
    if (statusCode < 400 || statusCode >= 500) return;

    const key = `loyalty:connector:4xx:${orgId}:${route}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.getClient().expire(key, CLIENT_ERROR_WINDOW_SECONDS);
      }
      if (count >= CLIENT_ERROR_SPIKE_THRESHOLD) {
        this.logger.warn(
          JSON.stringify({
            type: 'loyalty_connector_4xx_spike',
            orgId,
            route,
            statusCode,
            count,
            windowSeconds: CLIENT_ERROR_WINDOW_SECONDS,
          }),
        );
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Connector 4xx counter failed (ignored): ${detail}`);
    }
  }

  async getClientErrorCount(orgId: string, route = 'queue-events'): Promise<number | null> {
    try {
      const raw = await this.redis.getClient().get(`loyalty:connector:4xx:${orgId}:${route}`);
      if (raw == null) return 0;
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return null;
    }
  }
}
