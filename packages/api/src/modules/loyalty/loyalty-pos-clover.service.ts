import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LOYALTY_EARN_EVENT_TYPES, CLOVER_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { LoyaltyIntegrationService } from './loyalty-integration.service';

/**
 * Clover webhook payload (condensed).
 * Full reference: https://docs.clover.com/docs/webhooks
 */
interface CloverWebhookPayload {
  merchantId: string;
  type: string;
  /** Comma-separated list of object IDs affected */
  data?: string;
  appId?: string;
  time?: number;
}

/**
 * Clover Order object (from Clover REST API v3).
 * We fetch order details after receiving a webhook for accurate amounts.
 */
interface CloverCustomer {
  id: string;
  firstName?: string;
  lastName?: string;
  emailAddresses?: Array<{ emailAddress?: string }>;
  phoneNumbers?: Array<{ phoneNumber?: string }>;
}

interface CloverOrder {
  id: string;
  state?: string;
  total?: number; // in cents
  customers?: Array<CloverCustomer>;
}

@Injectable()
export class LoyaltyPosCloverService {
  private readonly logger = new Logger(LoyaltyPosCloverService.name);

  constructor(
    private readonly integration: LoyaltyIntegrationService,
    private readonly config: ConfigService,
  ) {}

  getOAuthUrl(orgId: string): string {
    const clientId = this.config.get<string>('app.posOauth.clover.clientId');
    const env = this.config.get<string>('app.posOauth.clover.environment') || 'sandbox';
    if (!clientId) throw new Error('Clover OAuth not configured');

    const baseUrl =
      env === 'production'
        ? 'https://www.clover.com/oauth/authorize'
        : 'https://sandbox.dev.clover.com/oauth/authorize';

    return `${baseUrl}?client_id=${clientId}&state=${orgId}`;
  }

  async exchangeOAuthCode(code: string): Promise<{ access_token: string }> {
    const clientId = this.config.get<string>('app.posOauth.clover.clientId');
    const clientSecret = this.config.get<string>('app.posOauth.clover.clientSecret');
    const env = this.config.get<string>('app.posOauth.clover.environment') || 'sandbox';

    const baseUrl =
      env === 'production'
        ? 'https://www.clover.com/oauth/token'
        : 'https://sandbox.dev.clover.com/oauth/token';

    const res = await fetch(
      `${baseUrl}?client_id=${clientId}&client_secret=${clientSecret}&code=${code}`,
      {
        method: 'GET',
      },
    );

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Clover OAuth failed: ${err}`);
      throw new Error(`Clover OAuth failed`);
    }

    return res.json() as Promise<{ access_token: string }>;
  }

  async processEvent(
    orgId: string,
    payload: CloverWebhookPayload,
    accessToken: string,
    merchantId: string,
  ): Promise<{ ok: boolean }> {
    const eventType = payload.type;
    this.logger.log(
      `Clover webhook event=${eventType} merchant=${payload.merchantId} orgId=${orgId}`,
    );

    switch (eventType) {
      case CLOVER_WEBHOOK_EVENTS.CREATE_ORDER:
      case CLOVER_WEBHOOK_EVENTS.UPDATE_ORDER:
        return this.handleOrder(orgId, payload, accessToken, merchantId);

      case CLOVER_WEBHOOK_EVENTS.CREATE_CUSTOMER:
        return this.handleCustomerCreated(orgId, payload, accessToken, merchantId);

      default:
        this.logger.debug(`Clover: unhandled event type=${eventType} — ignoring`);
        return { ok: true };
    }
  }

  // ─── Order ────────────────────────────────────────────────────────────────

  private async handleOrder(
    orgId: string,
    payload: CloverWebhookPayload,
    accessToken: string,
    merchantId: string,
  ): Promise<{ ok: boolean }> {
    const orderId = payload.data?.split(',')[0]?.trim();
    if (!orderId) return { ok: true };

    const order = await this.fetchCloverOrder(merchantId, orderId, accessToken);
    if (!order) return { ok: true };

    // Only process PAID orders
    if (order.state !== 'PAID') {
      this.logger.debug(`Clover order ${orderId} state=${order.state} — skip`);
      return { ok: true };
    }

    const totalCents = order.total ?? 0;
    if (totalCents <= 0) return { ok: true };

    const customer = order.customers?.[0];
    const externalId = customer ? `clv_${customer.id}` : undefined;
    const email = customer?.emailAddresses?.[0]?.emailAddress?.trim() || undefined;
    const phone = customer?.phoneNumbers?.[0]?.phoneNumber?.trim() || undefined;

    if (!externalId && !email && !phone) {
      this.logger.debug(`Clover order ${orderId} — no customer identity, skip`);
      return { ok: true };
    }

    try {
      if (customer) {
        const name =
          [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() ||
          'Clover Customer';
        await this.integration.upsertCustomer(orgId, {
          externalId,
          name,
          email: email ?? null,
          phone: phone ?? null,
        });
      }

      let lineItems:
        | Array<{
            id: string;
            name: string;
            categoryId?: string;
            priceCents: number;
            quantity: number;
          }>
        | undefined = undefined;
      const orderLineItems = (order as any).lineItems?.elements;
      if (orderLineItems && Array.isArray(orderLineItems)) {
        lineItems = orderLineItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          priceCents: item.price ?? 0,
          quantity: 1, // Clover line items might not have a direct quantity unless it's an expanded item, assume 1 for basic items or extract from qty
        }));
      }

      await this.integration.earnPoints(orgId, {
        externalId,
        email,
        phone,
        purchaseAmountCents: totalCents,
        lineItems,
        eventType: LOYALTY_EARN_EVENT_TYPES.PURCHASE,
        externalTxnId: `clv_${orderId}`,
        description: `Clover order (${(totalCents / 100).toFixed(2)})`,
      });

      return { ok: true };
    } catch (err) {
      this.logger.warn(`Clover order ${orderId} earn failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Customer created ─────────────────────────────────────────────────────

  private async handleCustomerCreated(
    orgId: string,
    payload: CloverWebhookPayload,
    accessToken: string,
    merchantId: string,
  ): Promise<{ ok: boolean }> {
    const customerId = payload.data?.split(',')[0]?.trim();
    if (!customerId) return { ok: true };

    const customer = await this.fetchCloverCustomer(merchantId, customerId, accessToken);
    if (!customer) return { ok: true };

    const name =
      [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || 'Clover Customer';
    const email = customer.emailAddresses?.[0]?.emailAddress?.trim() ?? null;
    const phone = customer.phoneNumbers?.[0]?.phoneNumber?.trim() ?? null;

    try {
      await this.integration.upsertCustomer(orgId, {
        externalId: `clv_${customerId}`,
        name,
        email,
        phone,
      });
      return { ok: true };
    } catch (err) {
      this.logger.warn(`Clover customer upsert failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Clover REST API helpers ───────────────────────────────────────────────

  private async fetchCloverOrder(
    merchantId: string,
    orderId: string,
    accessToken: string,
  ): Promise<CloverOrder | null> {
    try {
      const res = await fetch(
        `https://api.clover.com/v3/merchants/${merchantId}/orders/${orderId}?expand=customers,lineItems`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) {
        this.logger.warn(`Clover order fetch ${orderId} status=${res.status}`);
        return null;
      }
      return (await res.json()) as CloverOrder;
    } catch (err) {
      this.logger.warn(`Clover order fetch ${orderId} error: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchCloverCustomer(
    merchantId: string,
    customerId: string,
    accessToken: string,
  ): Promise<CloverCustomer | null> {
    try {
      const res = await fetch(
        `https://api.clover.com/v3/merchants/${merchantId}/customers/${customerId}?expand=emailAddresses,phoneNumbers`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) {
        this.logger.warn(`Clover customer fetch ${customerId} status=${res.status}`);
        return null;
      }
      return (await res.json()) as CloverCustomer;
    } catch (err) {
      this.logger.warn(`Clover customer fetch ${customerId} error: ${(err as Error).message}`);
      return null;
    }
  }
}
