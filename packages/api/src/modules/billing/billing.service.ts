import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RedisService } from '../../redis/redis.service';
import {
  SMS_CREDIT_PACKS,
  buildPaginationArgs,
  buildPaginationMeta,
  getSmsCreditPackBySlug,
} from '@queueplatform/shared';
import { SmsCreditPurchaseService } from './sms-credit-purchase.service';
import { SmsUsageService } from './sms-usage.service';
import { ProductEntitlementService } from '../../common/features/product-entitlement.service';
// Stripe v22 uses `export =` CJS style; compatible require-style import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeSDK: any = require('stripe');

type StripeClient = any;
type StripeEvent = any;
type StripeCheckoutSession = any;
type StripeSubscription = any;

/**
 * Manages billing, Stripe subscriptions, and plan enforcement.
 * Handles checkout sessions, webhooks, and subscription lifecycle events.
 *
 * Stripe integration is credential-gated: all methods that touch Stripe check for
 * a configured secret key via `ConfigService` before instantiating the client. The
 * system degrades gracefully when Stripe credentials are absent (development/free tier).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  /** Lazily-created Stripe client — avoids module-load-time crash when key is absent */
  private _stripe: StripeClient = null;
  private get stripe(): StripeClient {
    if (!this._stripe) {
      const key = this.config.get<string>('app.stripe.secretKey');
      if (!key) throw new BadRequestException('Stripe is not configured on this server');
      this._stripe = new StripeSDK(key, { apiVersion: '2025-03-31.basil' });
    }
    return this._stripe;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly smsCreditPurchases: SmsCreditPurchaseService,
    private readonly smsUsage: SmsUsageService,
    private readonly productEntitlements: ProductEntitlementService,
  ) {}

  private isStripeConfigured(): boolean {
    return Boolean(this.config.get<string>('app.stripe.secretKey'));
  }

  // ─── Plans ──────────────────────────────────────

  async listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  // ─── Subscription ──────────────────────────────

  async getSubscription(orgId: string) {
    const sub = await this.prisma.withTenant(orgId, (tx) =>
      tx.subscription.findFirst({
        where: { orgId, status: { in: ['active', 'trialing'] } },
        include: { plan: true },
      }),
    );
    if (!sub) throw new NotFoundException('No active subscription found');

    const [branchCount, userCount, ticketsThisMonth] = await this.prisma.withTenant(
      orgId,
      async (tx) => {
        return Promise.all([
          tx.branch.count({ where: { orgId } }),
          tx.user.count({ where: { orgId } }),
          tx.ticket.count({
            where: {
              orgId,
              bookedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
          }),
        ]);
      },
    );

    const limits = (sub.plan.limits ?? {}) as Record<string, unknown>;
    const allowance = await this.smsCreditPurchases.getSmsCreditsAllowance(orgId);
    const currentSmsUsed = await this.smsUsage.getUsedCount(orgId);

    return {
      ...sub,
      usage: {
        branches: { current: branchCount, limit: (limits.maxBranches as number) ?? 0 },
        users: { current: userCount, limit: (limits.maxUsers as number) ?? 0 },
        ticketsThisMonth: {
          current: ticketsThisMonth,
          limit: (limits.maxTicketsPerMonth as number) ?? 0,
        },
        smsCredits: {
          current: currentSmsUsed,
          planBase: allowance.planBase,
          purchasedBonus: allowance.purchasedBonus,
          limit: allowance.effectiveLimit,
        },
      },
    };
  }

  // ─── SMS credit packs (one-time Stripe checkout) ─────────────────────────

  listSmsPacks() {
    const checkoutEnabled = this.isStripeConfigured();
    return SMS_CREDIT_PACKS.map((pack) => {
      const messages = this.smsCreditPurchases.resolvePackMessages(pack);
      const stripePriceId = process.env[pack.stripePriceEnvKey]?.trim() || null;
      const priceUsd = pack.priceUsd;
      return {
        slug: pack.slug,
        label: pack.label,
        description: pack.description,
        messages,
        priceUsd,
        unitPriceUsd: messages > 0 ? Math.round((priceUsd / messages) * 1000) / 1000 : 0,
        checkoutEnabled,
        /** True when a catalog Stripe Price ID is set (optional; checkout still works via price_data). */
        stripePriceConfigured: Boolean(stripePriceId),
      };
    });
  }

  async createSmsCheckoutSession(
    orgId: string,
    packSlug: string,
    successUrl: string,
    cancelUrl: string,
    actorUserId?: string,
  ) {
    const pack = getSmsCreditPackBySlug(packSlug);
    if (!pack) throw new BadRequestException('Unknown SMS pack');

    if (!this.isStripeConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const messages = this.smsCreditPurchases.resolvePackMessages(pack);
    const stripePriceId = process.env[pack.stripePriceEnvKey]?.trim();
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const lineItem = stripePriceId
      ? { price: stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'usd',
            product_data: { name: `SMS messages (${messages.toLocaleString()})` },
            unit_amount: Math.round(pack.priceUsd * 100),
          },
          quantity: 1,
        };

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [lineItem],
      metadata: {
        type: 'sms_credit_pack',
        orgId,
        packSlug: pack.slug,
        messages: String(messages),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
    });

    const amountCents =
      session.amount_total ?? (stripePriceId ? null : Math.round(pack.priceUsd * 100)) ?? 0;

    await this.prisma.withTenant(orgId, (tx) =>
      tx.smsCreditPurchase.create({
        data: {
          orgId,
          packSlug: pack.slug,
          messages,
          amountCents: amountCents ?? 0,
          currency: (session.currency ?? 'usd').toUpperCase(),
          status: 'pending',
          stripeCheckoutSessionId: session.id,
        },
      }),
    );

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'billing.sms_checkout.create',
      resourceType: 'sms_credit_purchase',
      resourceId: session.id,
      metadata: { packSlug: pack.slug, messages },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Upgrades or downgrades the org's subscription plan.
   * If an active/trialing subscription exists it is updated in place;
   * otherwise a new 30-day subscription period is created.
   * Both paths emit an activity and audit log entry for compliance.
   */
  async changePlan(orgId: string, planId: string, actorUserId?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.subscription.findFirst({
        where: { orgId, status: { in: ['active', 'trialing'] } },
      }),
    );

    const previousPlanId = existing?.planId ?? null;

    if (existing) {
      const updated = await this.prisma.withTenant(orgId, (tx) =>
        tx.subscription.update({
          where: { id: existing.id },
          data: { planId, updatedAt: new Date() },
          include: { plan: true },
        }),
      );
      await this.audit.logActivity({
        orgId,
        userId: actorUserId,
        action: 'billing.plan.change',
        resourceType: 'subscription',
        resourceId: updated.id,
        metadata: { previousPlanId, planId },
      });
      await this.audit.logAudit({
        orgId,
        userId: actorUserId,
        action: 'update',
        tableName: 'subscriptions',
        recordId: updated.id,
        oldValues: { planId: previousPlanId },
        newValues: { planId },
      });
      // Invalidate cached plan limits so the new plan takes effect immediately
      await this.redis.del(`plan:limits:${orgId}`);
      await this.productEntitlements.syncLoyaltyFromPlanLimits(
        orgId,
        (updated.plan.limits ?? {}) as Record<string, unknown>,
      );
      return updated;
    } else {
      const created = await this.prisma.withTenant(orgId, (tx) =>
        tx.subscription.create({
          data: {
            orgId,
            planId,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          include: { plan: true },
        }),
      );
      await this.audit.logActivity({
        orgId,
        userId: actorUserId,
        action: 'billing.plan.create',
        resourceType: 'subscription',
        resourceId: created.id,
        metadata: { planId },
      });
      await this.audit.logAudit({
        orgId,
        userId: actorUserId,
        action: 'create',
        tableName: 'subscriptions',
        recordId: created.id,
        newValues: { planId, status: created.status },
      });
      // Invalidate cached plan limits so the new plan takes effect immediately
      await this.redis.del(`plan:limits:${orgId}`);
      await this.productEntitlements.syncLoyaltyFromPlanLimits(
        orgId,
        (created.plan.limits ?? {}) as Record<string, unknown>,
      );
      return created;
    }
  }

  /**
   * Marks the org's active subscription as cancelled.
   * Does not call Stripe — Stripe webhook handlers call this when a cancellation
   * is confirmed upstream via the `customer.subscription.deleted` event.
   */
  async cancelSubscription(orgId: string, actorUserId?: string) {
    const sub = await this.prisma.withTenant(orgId, (tx) =>
      tx.subscription.findFirst({
        where: { orgId, status: { in: ['active', 'trialing'] } },
      }),
    );
    if (!sub) throw new NotFoundException('No active subscription');

    const updated = await this.prisma.withTenant(orgId, (tx) =>
      tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'cancelled', updatedAt: new Date() },
      }),
    );
    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'billing.subscription.cancel',
      resourceType: 'subscription',
      resourceId: updated.id,
      metadata: { previousStatus: sub.status, status: updated.status },
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'update',
      tableName: 'subscriptions',
      recordId: updated.id,
      oldValues: { status: sub.status },
      newValues: { status: updated.status },
    });
    return updated;
  }

  // ─── Invoices ──────────────────────────────────

  /**
   * Returns a paginated history of Stripe-synced invoices for the org.
   * Invoices are ordered most-recent first.
   */
  async listInvoices(orgId: string, page = 1, limit = 20) {
    const args = buildPaginationArgs({ page, limit });
    const [data, total] = await this.prisma.withTenant(orgId, (tx) =>
      Promise.all([
        tx.invoice.findMany({
          where: { orgId },
          orderBy: { issuedAt: 'desc' },
          skip: args.skip,
          take: args.take,
        }),
        tx.invoice.count({ where: { orgId } }),
      ]),
    );
    return { data, meta: buildPaginationMeta({ page: args.page, limit: args.limit, total }) };
  }

  async getInvoice(orgId: string, invoiceId: string) {
    const invoice = await this.prisma.withTenant(orgId, (tx) =>
      tx.invoice.findFirst({
        where: { id: invoiceId, orgId },
        include: { paymentRecords: true },
      }),
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ─── Stripe Checkout ───────────────────────────

  /**
   * Creates a Stripe Checkout session for the given plan.
   * Reuses the org's existing Stripe customer when available to prevent duplicate customer records.
   * Uses a saved Stripe Price ID (from `plan.stripePriceIdMonthly`) when present for session
   * consistency; falls back to inline `price_data` so sessions still work before Price objects
   * are created in the Stripe dashboard.
   */
  async createCheckoutSession(
    orgId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string,
    billingInterval: 'monthly' | 'yearly' = 'monthly',
    actorUserId?: string,
  ) {
    const [plan, org] = await Promise.all([
      this.prisma.plan.findUnique({ where: { id: planId } }),
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { stripeCustomerId: true },
      }),
    ]);
    if (!plan) throw new NotFoundException('Plan not found');

    const secretKey = this.config.get<string>('app.stripe.secretKey');
    if (!secretKey) throw new BadRequestException('Stripe is not configured');

    const savedPriceId =
      billingInterval === 'yearly' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

    const lineItem = savedPriceId
      ? { price: savedPriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'usd',
            product_data: { name: `${plan.name} Plan` },
            unit_amount: Math.round(
              (billingInterval === 'yearly' ? plan.priceYearly : plan.priceMonthly) * 100,
            ),
            recurring: { interval: billingInterval === 'yearly' ? 'year' : 'month' },
          },
          quantity: 1,
        };

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [lineItem],
      metadata: { orgId, planId, billingInterval },
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(org?.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
    });

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'billing.checkout.create',
      resourceType: 'billing_checkout',
      resourceId: session.id,
      metadata: { planId, billingInterval },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Stripe checkout for Patron Loyalty add-on — enables CRM without replacing the queue plan.
   */
  async createLoyaltyAddonCheckoutSession(
    orgId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string,
    billingInterval: 'monthly' | 'yearly' = 'monthly',
    actorUserId?: string,
  ) {
    const [plan, org] = await Promise.all([
      this.prisma.plan.findUnique({ where: { id: planId } }),
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { stripeCustomerId: true },
      }),
    ]);
    if (!plan) throw new NotFoundException('Plan not found');

    const secretKey = this.config.get<string>('app.stripe.secretKey');
    if (!secretKey) throw new BadRequestException('Stripe is not configured');

    const savedPriceId =
      billingInterval === 'yearly' ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

    const lineItem = savedPriceId
      ? { price: savedPriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'usd',
            product_data: { name: `${plan.name} (Patron Loyalty add-on)` },
            unit_amount: Math.round(
              (billingInterval === 'yearly' ? plan.priceYearly : plan.priceMonthly) * 100,
            ),
            recurring: { interval: billingInterval === 'yearly' ? 'year' : 'month' },
          },
          quantity: 1,
        };

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [lineItem],
      metadata: { type: 'loyalty_addon', orgId, planId, billingInterval },
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(org?.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
    });

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'billing.loyalty_addon.checkout.create',
      resourceType: 'billing_checkout',
      resourceId: session.id,
      metadata: { planId, billingInterval },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Creates a Stripe Customer Portal session so the org's admin can manage their
   * subscription, update payment methods, and download invoices directly on Stripe.
   * Requires the org to have an existing `stripeCustomerId`.
   */
  async createPortalSession(orgId: string, returnUrl: string): Promise<{ url: string }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true },
    });
    if (!org?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer record found for this organisation');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  // ─── Stripe Webhooks ───────────────────────────

  /**
   * Validates and processes Stripe webhook events.
   *
   * Handled events:
   * - `checkout.session.completed`  — activates plan, stores Stripe IDs, records invoice
   * - `customer.subscription.updated` — syncs status, period dates, and Stripe IDs
   * - `customer.subscription.deleted` — marks subscription cancelled in DB
   * - `invoice.payment_succeeded`    — records a successful payment
   * - `invoice.payment_failed`       — logs a warning (future: notify admin or send email)
   */
  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.get<string>('app.stripe.webhookSecret');
    if (!webhookSecret) throw new BadRequestException('Stripe webhook secret not configured');

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as StripeSubscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as StripeSubscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        this.logger.debug(`Unhandled Stripe webhook event: ${event.type}`);
    }

    return { received: true };
  }

  // ─── Private webhook handlers ──────────────────

  private async handleCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
    const metadata = session.metadata ?? {};
    if (metadata.type === 'sms_credit_pack') {
      await this.handleSmsCreditPackCheckoutCompleted(session);
      return;
    }
    if (metadata.type === 'loyalty_addon') {
      await this.handleLoyaltyAddonCheckoutCompleted(session);
      return;
    }

    const { orgId, planId } = metadata;
    if (!orgId || !planId) return;

    // Activate the plan and get the resulting subscription
    const sub = await this.changePlan(orgId, planId);

    // Store Stripe customer + subscription IDs for future portal / webhook correlation
    await Promise.all([
      session.customer
        ? this.prisma.organization.update({
            where: { id: orgId },
            data: { stripeCustomerId: session.customer as string },
          })
        : Promise.resolve(),
      session.subscription
        ? this.prisma.withTenant(orgId, (tx) =>
            tx.subscription.update({
              where: { id: sub.id },
              data: { stripeSubscriptionId: session.subscription as string },
            }),
          )
        : Promise.resolve(),
    ]);

    // Create invoice record for the payment
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (plan && session.amount_total) {
      await this.prisma.withTenant(orgId, async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            orgId,
            subscriptionId: sub.id,
            amount: session.amount_total / 100,
            currency: session.currency?.toUpperCase() ?? 'USD',
            status: 'paid',
            issuedAt: new Date(),
            dueAt: new Date(),
            paidAt: new Date(),
          },
        });
        await tx.paymentRecord.create({
          data: {
            invoiceId: invoice.id,
            paymentProvider: 'stripe',
            providerRef: session.id,
            amount: session.amount_total / 100,
            status: 'succeeded',
            metadata: { customerId: session.customer, subscriptionId: session.subscription },
          },
        });
      });
    }

    await this.audit.logActivity({
      orgId,
      action: 'billing.webhook.checkout.completed',
      resourceType: 'stripe_checkout_session',
      resourceId: session.id,
      metadata: { planId },
    });
  }

  private async handleLoyaltyAddonCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
    const { orgId } = session.metadata ?? {};
    if (!orgId) return;

    await this.productEntitlements.enableLoyalty(orgId, 'subscription');

    if (session.customer) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: session.customer as string },
      });
    }

    await this.audit.logActivity({
      orgId,
      action: 'billing.webhook.loyalty_addon.completed',
      resourceType: 'stripe_checkout_session',
      resourceId: session.id,
      metadata: { planId: session.metadata?.planId ?? null },
    });
  }

  private async handleSmsCreditPackCheckoutCompleted(
    session: StripeCheckoutSession,
  ): Promise<void> {
    const result = await this.smsCreditPurchases.completePurchase(session.id);
    if (!result) return;

    const { orgId, messages } = result;
    if (session.customer) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: session.customer as string },
      });
    }

    if (session.amount_total) {
      const purchase = await this.prisma.withBypassRls((tx) =>
        tx.smsCreditPurchase.findUnique({
          where: { stripeCheckoutSessionId: session.id },
        }),
      );
      if (purchase) {
        await this.prisma.withTenant(orgId, async (tx) => {
          const invoice = await tx.invoice.create({
            data: {
              orgId,
              amount: session.amount_total / 100,
              currency: session.currency?.toUpperCase() ?? 'USD',
              status: 'paid',
              issuedAt: new Date(),
              dueAt: new Date(),
              paidAt: new Date(),
            },
          });
          await tx.paymentRecord.create({
            data: {
              invoiceId: invoice.id,
              paymentProvider: 'stripe',
              providerRef: session.id,
              amount: session.amount_total / 100,
              status: 'succeeded',
              metadata: {
                type: 'sms_credit_pack',
                packSlug: purchase.packSlug,
                messages: purchase.messages,
              },
            },
          });
        });
      }
    }

    await this.audit.logActivity({
      orgId,
      action: 'billing.webhook.sms_pack.completed',
      resourceType: 'sms_credit_purchase',
      resourceId: session.id,
      metadata: { messagesAdded: messages },
    });
  }

  private async handleSubscriptionUpdated(stripeSub: StripeSubscription): Promise<void> {
    const sub = await this.prisma.withBypassRls((tx) =>
      tx.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id },
      }),
    );
    if (!sub) {
      this.logger.warn(
        `customer.subscription.updated: no local subscription for Stripe ID ${stripeSub.id}`,
      );
      return;
    }

    await this.prisma.withTenant(sub.orgId, (tx) =>
      tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: stripeSub.status,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          ...(stripeSub.items?.data?.[0]?.price?.id
            ? { stripePriceId: stripeSub.items.data[0].price.id }
            : {}),
        },
      }),
    );

    this.logger.log(
      `Subscription ${sub.id} updated via Stripe webhook: status=${stripeSub.status}`,
    );
  }

  private async handleSubscriptionDeleted(stripeSub: StripeSubscription): Promise<void> {
    const sub = await this.prisma.withBypassRls((tx) =>
      tx.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id },
      }),
    );
    if (!sub) {
      this.logger.warn(
        `customer.subscription.deleted: no local subscription for Stripe ID ${stripeSub.id}`,
      );
      return;
    }

    await this.prisma.withTenant(sub.orgId, (tx) =>
      tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'cancelled' },
      }),
    );

    await this.audit.logActivity({
      orgId: sub.orgId,
      action: 'billing.subscription.deleted',
      resourceType: 'subscription',
      resourceId: sub.id,
      metadata: { stripeSubscriptionId: stripeSub.id },
    });

    this.logger.log(`Subscription ${sub.id} cancelled via Stripe webhook`);
  }

  private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    // Record the payment if this is for a known subscription
    const sub = invoice.subscription
      ? await this.prisma.withBypassRls((tx) =>
          tx.subscription.findFirst({
            where: { stripeSubscriptionId: invoice.subscription },
          }),
        )
      : null;

    if (sub && invoice.amount_paid > 0) {
      await this.prisma.withTenant(sub.orgId, async (tx) => {
        const invoiceRecord = await tx.invoice.create({
          data: {
            orgId: sub.orgId,
            subscriptionId: sub.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency?.toUpperCase() ?? 'USD',
            status: 'paid',
            issuedAt: new Date(invoice.created * 1000),
            dueAt: new Date((invoice.due_date ?? invoice.created) * 1000),
            paidAt: new Date(),
          },
        });
        await tx.paymentRecord.create({
          data: {
            invoiceId: invoiceRecord.id,
            paymentProvider: 'stripe',
            providerRef: invoice.id,
            amount: invoice.amount_paid / 100,
            status: 'succeeded',
            metadata: { stripeInvoiceId: invoice.id },
          },
        });
      });
    }
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    const sub = invoice.subscription
      ? await this.prisma.withBypassRls((tx) =>
          tx.subscription.findFirst({
            where: { stripeSubscriptionId: invoice.subscription },
            select: { id: true, orgId: true },
          }),
        )
      : null;

    this.logger.warn(
      `Stripe invoice payment failed: invoiceId=${invoice.id} orgId=${sub?.orgId ?? 'unknown'}`,
    );

    if (sub) {
      await this.audit.logActivity({
        orgId: sub.orgId,
        action: 'billing.invoice.payment_failed',
        resourceType: 'invoice',
        resourceId: invoice.id,
        metadata: { stripeInvoiceId: invoice.id, attemptCount: invoice.attempt_count },
      });
    }
  }
}
