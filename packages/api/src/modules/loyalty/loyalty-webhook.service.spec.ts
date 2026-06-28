import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { LoyaltyWebhookService } from './loyalty-webhook.service';

describe('LoyaltyWebhookService', () => {
  const webhooks = {
    dispatchEvent: vi.fn().mockResolvedValue(undefined),
  };
  let service: LoyaltyWebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyWebhookService(webhooks as never);
  });

  it('delegates loyalty events to WebhookService.dispatchEvent', async () => {
    const payload = { accountId: 'acc-1', points: 25 };
    await service.dispatch('org-1', LOYALTY_WEBHOOK_EVENTS.POINTS_EARNED, payload);

    expect(webhooks.dispatchEvent).toHaveBeenCalledWith(
      'org-1',
      LOYALTY_WEBHOOK_EVENTS.POINTS_EARNED,
      payload,
    );
  });
});
