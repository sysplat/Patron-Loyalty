import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  LOYALTY_CAMPAIGN_TRIGGERS,
  LOYALTY_EVENTS,
  LOYALTY_WEBHOOK_EVENTS,
} from '@queueplatform/shared';
import {
  LoyaltyAppointmentCompletedEvent,
  LoyaltyAppointmentNoShowEvent,
  LoyaltyCustomerCreatedEvent,
  LoyaltyReviewSubmittedEvent,
  LoyaltyTicketCompletedEvent,
  LoyaltyTicketNoShowEvent,
} from './loyalty.events';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyGamificationService } from './loyalty-gamification.service';
import { LoyaltyCampaignAutomationService } from './loyalty-campaign-automation.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LoyaltyListener {
  private readonly logger = new Logger(LoyaltyListener.name);

  constructor(
    private readonly accounts: LoyaltyAccountService,
    private readonly gamification: LoyaltyGamificationService,
    private readonly prisma: PrismaService,
    private readonly campaignAutomation: LoyaltyCampaignAutomationService,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
  ) {}

  private async resolveCustomerId(
    orgId: string,
    customerId: string | null,
    phone?: string | null,
    email?: string | null,
  ): Promise<string | null> {
    if (customerId) return customerId;
    if (!phone && !email) return null;
    const customer = await this.prisma.withTenant(orgId, (tx) =>
      tx.customer.findFirst({
        where: {
          orgId,
          OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
        },
        select: { id: true },
      }),
    );
    return customer?.id ?? null;
  }

  @OnEvent(LOYALTY_EVENTS.TICKET_COMPLETED, { async: true })
  async onTicketCompleted(event: LoyaltyTicketCompletedEvent) {
    try {
      if (!event.customerId) return;
      await this.accounts.handleTicketCompleted(
        event.orgId,
        event.ticketId,
        event.customerId,
        event.branchId,
      );
      await this.gamification.incrementChallengeProgress(event.orgId, event.customerId, 'VISITS');
      await this.gamification.evaluateBadgesForAccount(event.orgId, event.customerId);
    } catch (err) {
      this.logger.warn(`Loyalty ticket hook failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(LOYALTY_EVENTS.APPOINTMENT_COMPLETED, { async: true })
  async onAppointmentCompleted(event: LoyaltyAppointmentCompletedEvent) {
    try {
      const customerId = await this.resolveCustomerId(
        event.orgId,
        event.customerId,
        event.customerPhone,
        event.customerEmail,
      );
      if (!customerId) return;
      await this.accounts.handleAppointmentCompleted(event.orgId, event.appointmentId, customerId);
      await this.gamification.incrementChallengeProgress(event.orgId, customerId, 'VISITS');
    } catch (err) {
      this.logger.warn(`Loyalty appointment hook failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(LOYALTY_EVENTS.REVIEW_SUBMITTED, { async: true })
  async onReviewSubmitted(event: LoyaltyReviewSubmittedEvent) {
    try {
      if (!event.customerId) return;
      await this.accounts.handleReviewSubmitted(event.orgId, event.reviewId, event.customerId);
    } catch (err) {
      this.logger.warn(`Loyalty review hook failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(LOYALTY_EVENTS.CUSTOMER_CREATED, { async: true })
  async onCustomerCreated(event: LoyaltyCustomerCreatedEvent) {
    try {
      await this.accounts.ensureAccount(event.orgId, event.customerId);
      await this.campaignAutomation.fireTrigger(
        event.orgId,
        LOYALTY_CAMPAIGN_TRIGGERS.WELCOME,
        event.customerId,
      );
      void this.loyaltyWebhook.dispatch(event.orgId, LOYALTY_WEBHOOK_EVENTS.CUSTOMER_CREATED, {
        customerId: event.customerId,
      });
    } catch (err) {
      this.logger.warn(`Loyalty customer stub failed: ${(err as Error).message}`);
    }
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
  async onTicketNoShow(event: LoyaltyTicketNoShowEvent) {
    try {
      await this.accounts.handleNoShow(event.orgId, event.customerId, {
        sourceType: 'ticket',
        sourceId: event.ticketId,
      });
      if (event.customerId) {
        await this.campaignAutomation.fireTrigger(
          event.orgId,
          LOYALTY_CAMPAIGN_TRIGGERS.WIN_BACK,
          event.customerId,
        );
      }
    } catch (err) {
      this.logger.warn(`Loyalty ticket no-show hook failed: ${(err as Error).message}`);
    }
  }

  @OnEvent(LOYALTY_EVENTS.APPOINTMENT_NO_SHOW, { async: true })
  async onAppointmentNoShow(event: LoyaltyAppointmentNoShowEvent) {
    try {
      const customerId = await this.resolveCustomerId(
        event.orgId,
        event.customerId,
        event.customerPhone,
        event.customerEmail,
      );
      await this.accounts.handleNoShow(event.orgId, customerId, {
        sourceType: 'appointment',
        sourceId: event.appointmentId,
      });
      if (customerId) {
        await this.campaignAutomation.fireTrigger(
          event.orgId,
          LOYALTY_CAMPAIGN_TRIGGERS.WIN_BACK,
          customerId,
        );
      }
    } catch (err) {
      this.logger.warn(`Loyalty appointment no-show hook failed: ${(err as Error).message}`);
    }
  }
}
