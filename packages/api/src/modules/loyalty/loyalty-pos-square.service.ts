import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
        order_id?: string;
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

  constructor(
    private readonly integration: LoyaltyIntegrationService,
    private readonly config: ConfigService,
  ) {}

  getOAuthUrl(orgId: string): string {
    const clientId = this.config.get<string>('app.posOauth.square.clientId');
    const env = this.config.get<string>('app.posOauth.square.environment') || 'sandbox';
    if (!clientId) throw new Error('Square OAuth not configured');

    const baseUrl =
      env === 'production'
        ? 'https://connect.squareup.com/oauth2/authorize'
        : 'https://connect.squareupsandbox.com/oauth2/authorize';

    // Include the base Loyalty URL so Square knows where to redirect back.
    // However, Square requires the exact redirect URI to be pre-registered in their portal.
    return `${baseUrl}?client_id=${clientId}&scope=PAYMENTS_READ+CUSTOMERS_READ+ORDERS_READ&session=false&state=${orgId}`;
  }

  async exchangeOAuthCode(
    code: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    merchant_id: string;
    expires_at: string;
  }> {
    const clientId = this.config.get<string>('app.posOauth.square.clientId');
    const clientSecret = this.config.get<string>('app.posOauth.square.clientSecret');
    const env = this.config.get<string>('app.posOauth.square.environment') || 'sandbox';

    const baseUrl =
      env === 'production'
        ? 'https://connect.squareup.com/oauth2/token'
        : 'https://connect.squareupsandbox.com/oauth2/token';

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Square OAuth failed: ${err}`);
      throw new Error(`Square OAuth failed`);
    }

    return res.json() as Promise<{
      access_token: string;
      refresh_token: string;
      merchant_id: string;
      expires_at: string;
    }>;
  }

  async processEvent(
    orgId: string,
    payload: SquarePaymentPayload,
    accessToken: string,
  ): Promise<{ ok: boolean }> {
    const eventType = payload.type;
    this.logger.log(
      `Square webhook event=${eventType} merchant=${payload.merchant_id} orgId=${orgId}`,
    );

    switch (eventType) {
      case SQUARE_WEBHOOK_EVENTS.PAYMENT_CREATED:
      case SQUARE_WEBHOOK_EVENTS.PAYMENT_UPDATED:
        return this.handlePayment(orgId, payload, accessToken);

      case SQUARE_WEBHOOK_EVENTS.CUSTOMER_CREATED:
        return this.handleCustomerCreated(orgId, payload);

      default:
        this.logger.debug(`Square: unhandled event type=${eventType} — ignoring`);
        return { ok: true };
    }
  }

  // ─── Payment created/updated ──────────────────────────────────────────────

  private async handlePayment(
    orgId: string,
    payload: SquarePaymentPayload,
    accessToken: string,
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

      // Try to fetch order line items if there's an order_id
      let lineItems:
        | Array<{
            id: string;
            name: string;
            categoryId?: string;
            priceCents: number;
            quantity: number;
          }>
        | undefined = undefined;

      if (payment.order_id) {
        try {
          const orderRes = await fetch(
            `https://connect.squareup.com/v2/orders/${payment.order_id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          );
          if (orderRes.ok) {
            const orderData = (await orderRes.json()) as any;
            if (orderData.order && orderData.order.line_items) {
              lineItems = orderData.order.line_items.map((item: any) => ({
                id: item.uid,
                name: item.name,
                categoryId: item.catalog_object_id, // we might use this as category or sku
                priceCents: item.base_price_money?.amount ?? 0,
                quantity: parseInt(item.quantity ?? '1', 10),
              }));
            }
          }
        } catch (e) {
          this.logger.warn(
            `Failed to fetch Square order ${payment.order_id}: ${(e as Error).message}`,
          );
        }
      }

      // Award points based on purchase amount
      await this.integration.earnPoints(orgId, {
        externalId,
        email,
        purchaseAmountCents: totalCents,
        lineItems,
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
