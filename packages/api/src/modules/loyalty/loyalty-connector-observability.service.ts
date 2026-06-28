import { Injectable, Logger } from '@nestjs/common';
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
};

@Injectable()
export class LoyaltyConnectorObservabilityService {
  private readonly logger = new Logger('LoyaltyConnector');

  constructor(private readonly redis: RedisService) {}

  logIngest(entry: ConnectorIngestLog): void {
    this.logger.log(
      JSON.stringify({
        type: 'loyalty_connector_ingest',
        ...entry,
      }),
    );
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
}
