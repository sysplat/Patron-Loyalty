import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoyaltyIntegrationController } from './loyalty-integration.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';

describe('LoyaltyIntegrationController (delegation)', () => {
  const integration = {
    lookupCustomer: vi.fn(),
    upsertCustomer: vi.fn(),
    earnPoints: vi.fn(),
    redeemReward: vi.fn(),
    validateCoupon: vi.fn(),
    redeemCoupon: vi.fn(),
    adjustWallet: vi.fn(),
  };
  const queueEvents = { processRemoteEvent: vi.fn() };
  const connectorObs = { logIngest: vi.fn() };
  let controller: LoyaltyIntegrationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyIntegrationController(
      integration as never,
      queueEvents as never,
      connectorObs as never,
    );
  });

  it('delegates customer lookup with query params', async () => {
    integration.lookupCustomer.mockResolvedValue({ customerId: 'c1' });
    const result = await controller.lookupCustomer(ORG_ID, undefined, 'a@b.com', '+1', 'ext-1');
    expect(integration.lookupCustomer).toHaveBeenCalledWith(ORG_ID, {
      customerId: undefined,
      email: 'a@b.com',
      phone: '+1',
      externalId: 'ext-1',
    });
    expect(result).toEqual({ customerId: 'c1' });
  });

  it('delegates earn points to integration service', async () => {
    const body = {
      customerId: 'c1',
      eventType: 'MANUAL' as const,
      externalTxnId: 'txn-1',
      points: 10,
    };
    integration.earnPoints.mockResolvedValue({ idempotent: false });
    await controller.earnPoints(ORG_ID, body);
    expect(integration.earnPoints).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('delegates wallet adjust to integration service', async () => {
    const body = {
      customerId: 'c1',
      type: 'CREDIT' as const,
      amountCents: 500,
    };
    integration.adjustWallet.mockResolvedValue({ balanceCents: 1500 });
    await controller.adjustWallet(ORG_ID, body);
    expect(integration.adjustWallet).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('logs ingest outcome and returns queue-events result', async () => {
    const body = {
      event: 'ticket.completed' as const,
      sourceId: 'ticket-1',
      connectorVersion: 1,
      customer: { externalId: 'ext-1', name: 'Patron' },
    };
    queueEvents.processRemoteEvent.mockResolvedValue({ ok: true, idempotent: true });

    const result = await controller.ingestQueueEvent(ORG_ID, body);

    expect(queueEvents.processRemoteEvent).toHaveBeenCalledWith(ORG_ID, body);
    expect(connectorObs.logIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        route: 'queue-events',
        event: 'ticket.completed',
        sourceId: 'ticket-1',
        outcome: 'idempotent',
        idempotent: true,
      }),
    );
    expect(result).toEqual({ ok: true, idempotent: true });
  });

  it('records skipped outcome when queue handler skips', async () => {
    const body = {
      event: 'review.submitted' as const,
      sourceId: 'review-1',
      connectorVersion: 1,
      customerId: 'c1',
      rating: 5,
    };
    queueEvents.processRemoteEvent.mockResolvedValue({
      skipped: true,
      reason: 'crm_disabled',
    });

    await controller.ingestQueueEvent(ORG_ID, body);

    expect(connectorObs.logIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'skipped',
        skippedReason: 'crm_disabled',
      }),
    );
  });
});
