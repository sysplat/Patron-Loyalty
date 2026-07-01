import { Injectable, Logger } from '@nestjs/common';
import { LOYALTY_MARKETING_PROVIDERS } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyMarketingConnectionService } from './loyalty-marketing-connection.service';
import { LoyaltyMarketingKlaviyoProvider } from './loyalty-marketing-klaviyo.provider';
import { LoyaltyMarketingMailchimpProvider } from './loyalty-marketing-mailchimp.provider';

@Injectable()
export class LoyaltyMarketingSyncService {
  private readonly logger = new Logger(LoyaltyMarketingSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: LoyaltyMarketingConnectionService,
    private readonly klaviyo: LoyaltyMarketingKlaviyoProvider,
    private readonly mailchimp: LoyaltyMarketingMailchimpProvider,
  ) {}

  /**
   * Fire-and-forget: sync a patron's loyalty profile to all active marketing
   * connections for the org. Errors are caught per provider and never thrown.
   *
   * Call pattern:
   *   void this.marketingSync.syncProfile(orgId, customerId);
   */
  async syncProfile(orgId: string, customerId: string): Promise<void> {
    try {
      const profile = await this.buildProfile(orgId, customerId);
      if (!profile) return;

      const activeConnections = await this.connections.getActiveConnections(orgId);
      if (activeConnections.length === 0) return;

      await Promise.allSettled(
        activeConnections.map((conn) => this.dispatchToProvider(conn, profile, orgId)),
      );
    } catch (err) {
      // Top-level safety net — never let sync failures bubble into the caller
      this.logger.error(
        `Marketing sync unexpected error orgId=${orgId} customerId=${customerId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Manually trigger a full-org sync (e.g. after connecting a new provider).
   * Processes customers in pages of 100.
   */
  async syncAll(orgId: string): Promise<{ synced: number; errors: number }> {
    let cursor: string | undefined;
    let synced = 0;
    let errors = 0;

    do {
      const accounts = await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyAccount.findMany({
          where: { orgId },
          take: 100,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          select: { id: true, customerId: true },
        }),
      );

      if (accounts.length === 0) break;
      cursor = accounts[accounts.length - 1].id;

      for (const account of accounts) {
        try {
          await this.syncProfile(orgId, account.customerId);
          synced += 1;
        } catch {
          errors += 1;
        }
      }
    } while (true);

    return { synced, errors };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async buildProfile(orgId: string, customerId: string) {
    const row = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findFirst({
        where: { orgId, customerId },
        include: {
          tier: { select: { name: true, slug: true } },
          customer: {
            select: {
              email: true,
              phone: true,
              name: true,
            },
          },
        },
      }),
    );

    if (!row || !row.customer) return null;

    // Skip if no contact info — marketing platforms need at minimum an email
    if (!row.customer.email) return null;

    const [firstName, ...rest] = (row.customer.name ?? '').split(' ');
    const lastName = rest.join(' ');

    const referralUrl = row.referralCode
      ? `${process.env.LOYALTY_PORTAL_URL ?? ''}/join?ref=${row.referralCode}`
      : null;

    return {
      email: row.customer.email,
      phone: row.customer.phone ?? undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      loyaltyPoints: row.pointsBalance,
      loyaltyTier: row.tier?.name ?? 'Bronze',
      loyaltyLifetimeValueCents: row.lifetimePointsEarned, // points ≈ cents proxy; adjust as needed
      loyaltyTotalVisits: row.totalVisits,
      loyaltyReferralUrl: referralUrl,
    };
  }

  private async dispatchToProvider(
    conn: { provider: string; credentials: unknown; config: unknown },
    profile: NonNullable<Awaited<ReturnType<LoyaltyMarketingSyncService['buildProfile']>>>,
    orgId: string,
  ): Promise<void> {
    const apiKey = this.connections.decryptApiKey(conn);
    const cfg = conn.config as Record<string, string>;

    try {
      if (conn.provider === LOYALTY_MARKETING_PROVIDERS.KLAVIYO) {
        await this.klaviyo.upsertProfile(apiKey, profile);
        void this.connections.touchSyncedAt(orgId, LOYALTY_MARKETING_PROVIDERS.KLAVIYO);
      } else if (conn.provider === LOYALTY_MARKETING_PROVIDERS.MAILCHIMP) {
        if (!profile.email) return; // Mailchimp requires email
        await this.mailchimp.upsertMember(apiKey, cfg.listId, cfg.serverPrefix, profile);
        void this.connections.touchSyncedAt(orgId, LOYALTY_MARKETING_PROVIDERS.MAILCHIMP);
      }
    } catch (err) {
      // Per-provider isolation — one provider failing does not block others
      this.logger.warn(
        `Marketing sync provider=${conn.provider} orgId=${orgId} error: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Processes an incoming webhook from a marketing provider (e.g. an unsubscribe event).
   * Finds the customer by email and updates their consent ledger if they unsubscribed.
   */
  async processWebhook(provider: string, payload: any): Promise<void> {
    try {
      let email: string | undefined;
      let action: string | undefined;

      // Determine email and action based on provider
      if (provider === LOYALTY_MARKETING_PROVIDERS.KLAVIYO) {
        // e.g. Klaviyo unsubscribe event
        if (payload?.type === 'unsubscribe') {
          email = payload.data?.email;
          action = 'REVOKED';
        }
      } else if (provider === LOYALTY_MARKETING_PROVIDERS.MAILCHIMP) {
        // Mailchimp unsubscribe webhook
        if (payload?.type === 'unsubscribe') {
          email = payload.data?.email;
          action = 'REVOKED';
        }
      }

      if (!email || !action) return;

      const customers = await this.prisma.customer.findMany({
        where: { email },
        select: { id: true, orgId: true },
      });

      for (const customer of customers) {
        await this.prisma.withTenant(customer.orgId, async (tx) => {
          // Update customer record
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              marketingEmailConsent: action,
              marketingConsentSource: provider,
            },
          });
          // Add ledger entry
          await tx.consentLedgerEntry.create({
            data: {
              orgId: customer.orgId,
              customerId: customer.id,
              channel: 'email',
              purpose: 'marketing',
              action: action,
              source: provider,
            },
          });
        });
        this.logger.log(
          `Updated marketing consent to ${action} for customer ${customer.id} in org ${customer.orgId} from ${provider} webhook`,
        );
      }
    } catch (err) {
      this.logger.error(`Error processing ${provider} webhook: ${(err as Error).message}`);
    }
  }
}
