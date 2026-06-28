import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyConnectorObservabilityService } from './loyalty-connector-observability.service';

describe('LoyaltyConnectorObservabilityService', () => {
  const redis = {
    incr: vi.fn(),
    getClient: vi.fn(() => ({ expire: vi.fn().mockResolvedValue(1) })),
  };

  let service: LoyaltyConnectorObservabilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyConnectorObservabilityService(redis as never);
  });

  it('logs structured ingest events', () => {
    const logSpy = vi.spyOn(service['logger'], 'log');
    service.logIngest({
      orgId: 'org-1',
      route: 'queue-events',
      event: 'ticket.completed',
      sourceId: 't-1',
      durationMs: 12,
      outcome: 'ok',
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"loyalty_connector_ingest"'),
    );
  });

  it('warns when 4xx count crosses spike threshold', async () => {
    redis.incr.mockResolvedValue(10);
    const warnSpy = vi.spyOn(service['logger'], 'warn');
    await service.recordClientError('org-1', 'queue-events', 400);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"loyalty_connector_4xx_spike"'),
    );
  });
});
