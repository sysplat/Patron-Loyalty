import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LoyaltyConnectorObservabilityService,
  redactConnectorPayload,
} from './loyalty-connector-observability.service';

describe('LoyaltyConnectorObservabilityService', () => {
  const redis = {
    incr: vi.fn(),
    getClient: vi.fn(() => ({
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue('3'),
    })),
  };
  const prisma = {
    withTenant: vi.fn((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyIntegrationEvent: {
          create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
        },
      }),
    ),
  };
  const requestContext = { getRequestId: vi.fn().mockReturnValue('req-als') };

  let service: LoyaltyConnectorObservabilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyConnectorObservabilityService(
      redis as never,
      prisma as never,
      requestContext as never,
    );
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

  it('persists redacted integration events', async () => {
    await service.recordIngest({
      orgId: 'org-1',
      route: 'queue-events',
      event: 'ticket.completed',
      sourceId: 't-1',
      durationMs: 12,
      outcome: 'ok',
      redactedPayload: { event: 'ticket.completed' },
    });
    expect(prisma.withTenant).toHaveBeenCalled();
  });

  it('warns when 4xx count crosses spike threshold', async () => {
    redis.incr.mockResolvedValue(10);
    const warnSpy = vi.spyOn(service['logger'], 'warn');
    await service.recordClientError('org-1', 'queue-events', 400);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"loyalty_connector_4xx_spike"'),
    );
  });

  it('redacts sensitive payload keys', () => {
    const redacted = redactConnectorPayload({
      event: 'ticket.completed',
      phone: '+15551212',
      nested: { email: 'a@b.c', sourceId: 'x' },
    });
    expect(redacted?.phone).toBe('[redacted]');
    expect((redacted?.nested as { email: string }).email).toBe('[redacted]');
    expect((redacted?.nested as { sourceId: string }).sourceId).toBe('x');
  });
});
