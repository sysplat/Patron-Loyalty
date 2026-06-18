import { Injectable } from '@nestjs/common';
import { LOYALTY_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { WebhookService } from '../webhook/webhook.service';

@Injectable()
export class LoyaltyWebhookService {
  constructor(private readonly webhooks: WebhookService) {}

  async dispatch(
    orgId: string,
    event: (typeof LOYALTY_WEBHOOK_EVENTS)[keyof typeof LOYALTY_WEBHOOK_EVENTS],
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.webhooks.dispatchEvent(orgId, event, data);
  }
}
