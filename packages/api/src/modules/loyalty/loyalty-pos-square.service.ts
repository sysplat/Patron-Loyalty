import { Injectable, Logger } from '@nestjs/common';
import { LOYALTY_EARN_EVENT_TYPES, SQUARE_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { LoyaltyIntegrationService } from './loyalty-integration.service';

/**
 * Square payment.created webhook payload (condensed to fields we use).
 * Full reference: https://developer.squareup.com/reference/square/objects/Payment
 */
interface SquarePaymentPayload {
  merchant_id: string;
  location_id: string;
  type: string;
  event_id: string;
  data: {
    object: {
      payment?: {
        id: string;
        status?: string;
        total_money?: { amount?: number; currency?: string };
        buyer_email_address?: string;
        customer_id?: string;
        source_type?: string;
      };
      customer?: {
        id: string;
        given_name?: string;
        family_name?: string;
        email_address?: string;
        phone_number?: string;
      };
    };
  };
}

@Injectable()
export class LoyaltyPosSquareService {
  private readonly logger = new Logger(LoyaltyPosSquareService.name);

  constructor(private readonly integration: LoyaltyIntegrationService) {}

  async processEvent(orgId: string, payload: SquarePaymentPayload): Promise<{ ok: boolean }> {
    const eventType = payload.type;
    this.logger.log(
      `Square webhook event=${eventType} merchant=${payload.merchant_id} orgId=${orgId}`,
    );

    switch (eventType) {
      case SQUARE_WEBHOOK_EVENTS.PAYMENT_CREATED:
      case SQUARE_WEBHOOK_EVENTS.PAYMENT_UPDATED:
        return this.handlePayment(orgId, payload);

      case SQUARE_WEBHOOK_EVENTS.CUSTOMER_CREATED:
        return this.handleCustomerCreated(orgId, payload);

      default:
        this.logger.debug(`Square: unhandled event type=${eventType} — ignoring`);
        return { ok: true };
    }
  }

  // ─── Payment ──────────────────────────────────────────────────────────────

  private async handlePayment(
    orgId: string,
    payload: SquarePaymentPayload,
  ): Promise<{ ok: boolean }> {
    const payment = payload.data.object.payment;
    if (!payment) return { ok: true };

    // Only process completed (COMPLETED) payments
    if (payment.status !== 'COMPLETED') {
      this.logger.debug(`Square payment ${payment.id} status=${payment.status} — skip`);
      return { ok: true };
    }

    const totalCents = payment.total_money?.amount ?? 0;
    if (totalCents <= 0) return { ok: true };

    // Build customer identity. Square customer_id prefixed with sq_ as externalId.
    const externalId = payment.customer_id ? `sq_${payment.customer_id}` : undefined;
    const email = payment.buyer_email_address?.trim() || undefined;

    if (!externalId && !email) {
      this.logger.debug(`Square payment ${payment.id} — no customer identity, skip`);
      return { ok: true };
    }

    try {
      // Upsert customer first to ensure they exist
      await this.integration.upsertCustomer(orgId, {
        externalId,
        name: 'Square Customer',
        email: email ?? null,
      });

      // Award points based on purchase amount
      await this.integration.earnPoints(orgId, {
        externalId,
        email,
        purchaseAmountCents: totalCents,
        eventType: LOYALTY_EARN_EVENT_TYPES.PURCHASE,
        externalTxnId: `sq_${payment.id}`,
        description: `Square payment (${(totalCents / 100).toFixed(2)} ${payment.total_money?.currency ?? 'USD'})`,
      });

      return { ok: true };
    } catch (err) {
      this.logger.warn(`Square payment ${payment.id} earn failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Customer created ─────────────────────────────────────────────────────

  private async handleCustomerCreated(
    orgId: string,
    payload: SquarePaymentPayload,
  ): Promise<{ ok: boolean }> {
    const customer = payload.data.object.customer;
    if (!customer) return { ok: true };

    const name =
      [customer.given_name, customer.family_name].filter(Boolean).join(' ').trim() ||
      'Square Customer';

    try {
      await this.integration.upsertCustomer(orgId, {
        externalId: `sq_${customer.id}`,
        name,
        email: customer.email_address?.trim() ?? null,
        phone: customer.phone_number?.trim() ?? null,
      });
      return { ok: true };
    } catch (err) {
      this.logger.warn(`Square customer upsert failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
