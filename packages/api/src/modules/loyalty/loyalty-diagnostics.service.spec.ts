import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyDiagnosticsService } from './loyalty-diagnostics.service';

describe('LoyaltyDiagnosticsService', () => {
  const prisma = {
    withTenant: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
  const redis = {
    getClient: vi.fn(() => ({ ping: vi.fn().mockResolvedValue('PONG') })),
  };
  const connectorObs = {
    getClientErrorCount: vi.fn().mockResolvedValue(2),
  };

  let service: LoyaltyDiagnosticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyDiagnosticsService(prisma as never, redis as never, connectorObs as never);
  });

  it('returns summary with health and connector counters', async () => {
    prisma.withTenant.mockImplementation(async (_orgId: string, fn: (tx: any) => unknown) => {
      const tx = {
        notification: {
          groupBy: vi.fn().mockResolvedValue([{ status: 'failed', _count: { _all: 1 } }]),
          findMany: vi.fn().mockResolvedValue([]),
        },
        loyaltyCampaignSend: {
          groupBy: vi.fn().mockResolvedValue([{ status: 'sent', _count: { _all: 3 } }]),
        },
        loyaltyRedemption: { count: vi.fn().mockResolvedValue(0) },
        loyaltyIntegrationEvent: { findFirst: vi.fn().mockResolvedValue(null) },
      };
      return fn(tx);
    });

    const summary = await service.getSummary('org-1', 24);
    expect(summary.notifications.failed).toBe(1);
    expect(summary.campaigns.sent).toBe(3);
    expect(summary.connector.clientErrorCount4xx).toBe(2);
    expect(summary.health.api).toBe('ok');
  });

  it('lists integration events', async () => {
    prisma.withTenant.mockImplementation(async (_orgId: string, fn: (tx: any) => unknown) =>
      fn({
        loyaltyIntegrationEvent: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'e1',
              createdAt: new Date('2026-09-01T00:00:00Z'),
              route: 'queue-events',
              event: 'ticket.completed',
              sourceId: 't1',
              outcome: 'ok',
              httpStatus: 200,
              durationMs: 11,
              requestId: 'req-1',
              idempotencyKey: 't1',
              redactedPayload: { event: 'ticket.completed' },
            },
          ]),
        },
      }),
    );

    const result = await service.listIntegrationEvents('org-1', { limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.route).toBe('queue-events');
    expect(result.items[0]?.requestId).toBe('req-1');
  });
});
