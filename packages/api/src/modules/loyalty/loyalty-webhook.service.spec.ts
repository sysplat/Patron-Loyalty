import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { LoyaltyWebhookService } from './loyalty-webhook.service';

describe('LoyaltyWebhookService', () => {
  const webhooks = { dispatchEvent: vi.fn().mockResolvedValue(undefined) };
  let service: LoyaltyWebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyWebhookService(webhooks as never);
  });

  it('dispatches loyalty webhook events via WebhookService', async () => {
    const payload = { customerId: 'cust-1', points: 50 };
    await service.dispatch('org-1', LOYALTY_WEBHOOK_EVENTS.POINTS_EARNED, payload);

    expect(webhooks.dispatchEvent).toHaveBeenCalledWith(
      'org-1',
      LOYALTY_WEBHOOK_EVENTS.POINTS_EARNED,
      payload,
    );
  });
});
