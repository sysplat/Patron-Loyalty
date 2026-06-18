import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  LOYALTY_CAMPAIGN_TRIGGERS,
  LOYALTY_EVENTS,
  LOYALTY_WEBHOOK_EVENTS,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyQueueEventsService } from './loyalty-queue-events.service';
import { LoyaltyCampaignAutomationService } from './loyalty-campaign-automation.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';
import {
  LoyaltyAppointmentCompletedEvent,
  LoyaltyAppointmentNoShowEvent,
  LoyaltyCustomerCreatedEvent,
  LoyaltyReviewSubmittedEvent,
  LoyaltyTicketCompletedEvent,
  LoyaltyTicketNoShowEvent,
} from './loyalty.events';

@Injectable()
export class LoyaltyListener {
  private readonly logger = new Logger(LoyaltyListener.name);

  constructor(
    private readonly queueEvents: LoyaltyQueueEventsService,
    private readonly prisma: PrismaService,
    private readonly campaignAutomation: LoyaltyCampaignAutomationService,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
  ) {}

  @OnEvent(LOYALTY_EVENTS.TICKET_COMPLETED, { async: true })
  onTicketCompleted(event: LoyaltyTicketCompletedEvent) {
    return this.queueEvents.onTicketCompleted(event);
  }

  @OnEvent(LOYALTY_EVENTS.APPOINTMENT_COMPLETED, { async: true })
  onAppointmentCompleted(event: LoyaltyAppointmentCompletedEvent) {
    return this.queueEvents.onAppointmentCompleted(event);
  }

  @OnEvent(LOYALTY_EVENTS.REVIEW_SUBMITTED, { async: true })
  onReviewSubmitted(event: LoyaltyReviewSubmittedEvent) {
    return this.queueEvents.onReviewSubmitted(event);
  }

  @OnEvent(LOYALTY_EVENTS.CUSTOMER_CREATED, { async: true })
  onCustomerCreated(event: LoyaltyCustomerCreatedEvent) {
    return this.queueEvents.onCustomerCreated(event);
  }

  @OnEvent(LOYALTY_EVENTS.TIER_UPGRADED, { async: true })
  async onTierUpgraded(orgId: string, accountId: string, tierSlug: string) {
    try {
      const account = await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyAccount.findFirst({
          where: { id: accountId, orgId },
          select: { customerId: true },
        }),
      );
      if (!account) return;
      await this.campaignAutomation.fireTrigger(
        orgId,
        LOYALTY_CAMPAIGN_TRIGGERS.TIER_UPGRADE,
        account.customerId,
      );
      void this.loyaltyWebhook.dispatch(orgId, LOYALTY_WEBHOOK_EVENTS.TIER_UPGRADED, {
        customerId: account.customerId,
        accountId,
        tierSlug,
      });
    } catch (err) {
      this.logger.warn(`Loyalty tier campaign hook failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(LOYALTY_EVENTS.TICKET_NO_SHOW, { async: true })
  onTicketNoShow(event: LoyaltyTicketNoShowEvent) {
    return this.queueEvents.onTicketNoShow(event);
  }

  @OnEvent(LOYALTY_EVENTS.APPOINTMENT_NO_SHOW, { async: true })
  onAppointmentNoShow(event: LoyaltyAppointmentNoShowEvent) {
    return this.queueEvents.onAppointmentNoShow(event);
  }
}
