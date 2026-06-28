import { Injectable, Logger } from '@nestjs/common';
import {
  LOYALTY_CAMPAIGN_TRIGGERS,
  LOYALTY_WEBHOOK_EVENTS,
  QLESSQ_QUEUE_INTEGRATION_EVENTS,
  type QlessqQueueIntegrationEvent,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { customerPhoneOr } from '../customer/customer-contact.util';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyGamificationService } from './loyalty-gamification.service';
import { LoyaltyCampaignAutomationService } from './loyalty-campaign-automation.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';
import { LoyaltyIntegrationService } from './loyalty-integration.service';
import {
  LoyaltyAppointmentCompletedEvent,
  LoyaltyAppointmentNoShowEvent,
  LoyaltyCustomerCreatedEvent,
  LoyaltyReviewSubmittedEvent,
  LoyaltyTicketCompletedEvent,
  LoyaltyTicketNoShowEvent,
} from './loyalty.events';

export type LoyaltyQueueEventPayload = {
  event: QlessqQueueIntegrationEvent;
  sourceId: string;
  branchId?: string;
  serviceId?: string | null;
  customerId?: string;
  customer?: {
    externalId: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
  };
  customerPhone?: string | null;
  customerEmail?: string | null;
  rating?: number;
};

@Injectable()
export class LoyaltyQueueEventsService {
  private readonly logger = new Logger(LoyaltyQueueEventsService.name);

  constructor(
    private readonly accounts: LoyaltyAccountService,
    private readonly gamification: LoyaltyGamificationService,
    private readonly prisma: PrismaService,
    private readonly campaignAutomation: LoyaltyCampaignAutomationService,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
    private readonly integration: LoyaltyIntegrationService,
  ) {}

  async processRemoteEvent(orgId: string, payload: LoyaltyQueueEventPayload) {
    this.logger.log(
      `Ingest queue-event event=${payload.event} sourceId=${payload.sourceId} orgId=${orgId}`,
    );

    let result: Record<string, unknown>;
    switch (payload.event) {
      case QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED:
        result = await this.onTicketCompleted(
          new LoyaltyTicketCompletedEvent(
            orgId,
            payload.sourceId,
            await this.resolveCustomerId(orgId, payload),
            payload.branchId ?? '',
            payload.serviceId ?? null,
          ),
        );
        break;
      case QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_NO_SHOW:
        result = await this.onTicketNoShow(
          new LoyaltyTicketNoShowEvent(
            orgId,
            payload.sourceId,
            await this.resolveCustomerId(orgId, payload),
            payload.branchId ?? '',
          ),
        );
        break;
      case QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_COMPLETED:
        result = await this.onAppointmentCompleted(
          new LoyaltyAppointmentCompletedEvent(
            orgId,
            payload.sourceId,
            await this.resolveCustomerId(orgId, payload),
            payload.branchId ?? '',
            payload.customerPhone,
            payload.customerEmail,
          ),
        );
        break;
      case QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_NO_SHOW:
        result = await this.onAppointmentNoShow(
          new LoyaltyAppointmentNoShowEvent(
            orgId,
            payload.sourceId,
            await this.resolveCustomerId(orgId, payload),
            payload.branchId ?? '',
            payload.customerPhone,
            payload.customerEmail,
          ),
        );
        break;
      case QLESSQ_QUEUE_INTEGRATION_EVENTS.REVIEW_SUBMITTED:
        result = await this.onReviewSubmitted(
          new LoyaltyReviewSubmittedEvent(
            orgId,
            payload.sourceId,
            await this.resolveCustomerId(orgId, payload),
            payload.rating ?? 5,
          ),
        );
        break;
      case QLESSQ_QUEUE_INTEGRATION_EVENTS.CUSTOMER_CREATED: {
        const customerId = await this.resolveCustomerId(orgId, payload);
        if (!customerId) {
          result = { skipped: true, reason: 'no_customer' };
          break;
        }
        result = await this.onCustomerCreated(new LoyaltyCustomerCreatedEvent(orgId, customerId));
        break;
      }
      default: {
        const _exhaustive: never = payload.event;
        return _exhaustive;
      }
    }

    this.logger.log(
      `Processed queue-event event=${payload.event} sourceId=${payload.sourceId} orgId=${orgId} result=${JSON.stringify(result)}`,
    );
    return { ...result, event: payload.event, sourceId: payload.sourceId };
  }

  async onTicketCompleted(event: LoyaltyTicketCompletedEvent) {
    try {
      if (!event.customerId) return { skipped: true, reason: 'no_customer' };
      const earned = await this.accounts.handleTicketCompleted(
        event.orgId,
        event.ticketId,
        event.customerId,
        event.branchId,
      );
      if (earned?.idempotent) return { ok: true, idempotent: true };
      if (earned) {
        await this.gamification.incrementChallengeProgress(event.orgId, event.customerId, 'VISITS');
        await this.gamification.evaluateBadgesForAccount(event.orgId, event.customerId);
      }
      return { ok: true };
    } catch (err) {
      this.logger.warn(`Loyalty ticket hook failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async onAppointmentCompleted(event: LoyaltyAppointmentCompletedEvent) {
    try {
      const customerId = await this.resolveCustomerIdFromEvent(event);
      if (!customerId) return { skipped: true, reason: 'no_customer' };
      const earned = await this.accounts.handleAppointmentCompleted(
        event.orgId,
        event.appointmentId,
        customerId,
        event.branchId,
      );
      if (earned?.idempotent) return { ok: true, idempotent: true };
      if (earned) {
        await this.gamification.incrementChallengeProgress(event.orgId, customerId, 'VISITS');
      }
      return { ok: true };
    } catch (err) {
      this.logger.warn(`Loyalty appointment hook failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async onReviewSubmitted(event: LoyaltyReviewSubmittedEvent) {
    try {
      if (!event.customerId) return { skipped: true, reason: 'no_customer' };
      const earned = await this.accounts.handleReviewSubmitted(
        event.orgId,
        event.reviewId,
        event.customerId,
      );
      if (earned?.idempotent) return { ok: true, idempotent: true };
      return { ok: true };
    } catch (err) {
      this.logger.warn(`Loyalty review hook failed: ${(err as Error).message}`);
      throw err;
    }
  }

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
      return { ok: true };
    } catch (err) {
      this.logger.warn(`Loyalty customer stub failed: ${(err as Error).message}`);
      throw err;
    }
  }

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
      return { ok: true };
    } catch (err) {
      this.logger.warn(`Loyalty ticket no-show hook failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async onAppointmentNoShow(event: LoyaltyAppointmentNoShowEvent) {
    try {
      const customerId = await this.resolveCustomerIdFromEvent(event);
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
      return { ok: true };
    } catch (err) {
      this.logger.warn(`Loyalty appointment no-show hook failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async resolveCustomerId(
    orgId: string,
    payload: LoyaltyQueueEventPayload,
  ): Promise<string | null> {
    if (payload.customerId) return payload.customerId;

    if (payload.customer?.externalId) {
      const upserted = await this.integration.upsertCustomer(orgId, {
        externalId: payload.customer.externalId,
        name: payload.customer.name ?? 'Patron',
        email: payload.customer.email,
        phone: payload.customer.phone,
      });
      return upserted.customerId;
    }

    const phone = payload.customerPhone ?? payload.customer?.phone;
    const email = payload.customerEmail ?? payload.customer?.email;
    if (!phone && !email) return null;

    const phoneOr = phone ? customerPhoneOr(phone) : [];
    const customer = await this.prisma.withTenant(orgId, (tx) =>
      tx.customer.findFirst({
        where: {
          orgId,
          OR: [...phoneOr, ...(email ? [{ email }] : [])],
        },
        select: { id: true },
      }),
    );
    return customer?.id ?? null;
  }

  private async resolveCustomerIdFromEvent(
    event: LoyaltyAppointmentCompletedEvent | LoyaltyAppointmentNoShowEvent,
  ): Promise<string | null> {
    if (event.customerId) return event.customerId;
    if (!event.customerPhone && !event.customerEmail) return null;
    const phoneOr = event.customerPhone ? customerPhoneOr(event.customerPhone) : [];
    const customer = await this.prisma.withTenant(event.orgId, (tx) =>
      tx.customer.findFirst({
        where: {
          orgId: event.orgId,
          OR: [...phoneOr, ...(event.customerEmail ? [{ email: event.customerEmail }] : [])],
        },
        select: { id: true },
      }),
    );
    return customer?.id ?? null;
  }
}
