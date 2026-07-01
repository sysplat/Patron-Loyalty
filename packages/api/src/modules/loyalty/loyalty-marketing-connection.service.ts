import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  LOYALTY_MARKETING_PROVIDERS,
  type LoyaltyMarketingProvider,
  type LoyaltyKlaviyoConnectionInput,
  type LoyaltyMailchimpConnectionInput,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type MarketingConnectionView = {
  provider: LoyaltyMarketingProvider;
  status: string;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Non-sensitive config only */
  config: Record<string, string>;
};

@Injectable()
export class LoyaltyMarketingConnectionService {
  private readonly logger = new Logger(LoyaltyMarketingConnectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Encryption helpers ───────────────────────────────────────────────────

  private getEncryptionKey(): Buffer {
    const raw = process.env.MARKETING_ENCRYPTION_KEY ?? process.env.POS_ENCRYPTION_KEY;
    if (!raw || raw.length < 64) {
      throw new Error(
        'MARKETING_ENCRYPTION_KEY must be set to a 32-byte (64 hex chars) secret in .env',
      );
    }
    return Buffer.from(raw.slice(0, 64), 'hex');
  }

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(encoded: string): string {
    const key = this.getEncryptionKey();
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async upsertKlaviyo(
    orgId: string,
    input: LoyaltyKlaviyoConnectionInput,
  ): Promise<MarketingConnectionView> {
    const credentials = { encryptedApiKey: this.encrypt(input.apiKey) };
    const row = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyMarketingConnection.upsert({
        where: { orgId_provider: { orgId, provider: LOYALTY_MARKETING_PROVIDERS.KLAVIYO } },
        create: { orgId, provider: LOYALTY_MARKETING_PROVIDERS.KLAVIYO, credentials, config: {} },
        update: { credentials, status: 'active' },
      }),
    );
    return this.toView(row);
  }

  async upsertMailchimp(
    orgId: string,
    input: LoyaltyMailchimpConnectionInput,
  ): Promise<MarketingConnectionView> {
    const credentials = { encryptedApiKey: this.encrypt(input.apiKey) };
    const config = { listId: input.listId, serverPrefix: input.serverPrefix };
    const row = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyMarketingConnection.upsert({
        where: { orgId_provider: { orgId, provider: LOYALTY_MARKETING_PROVIDERS.MAILCHIMP } },
        create: { orgId, provider: LOYALTY_MARKETING_PROVIDERS.MAILCHIMP, credentials, config },
        update: { credentials, config, status: 'active' },
      }),
    );
    return this.toView(row);
  }

  async listConnections(orgId: string): Promise<MarketingConnectionView[]> {
    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyMarketingConnection.findMany({ where: { orgId } }),
    );
    return rows.map((r) => this.toView(r));
  }

  async deleteConnection(orgId: string, provider: LoyaltyMarketingProvider): Promise<void> {
    await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyMarketingConnection.deleteMany({ where: { orgId, provider } }),
    );
  }

  /** Load all active connections for sync dispatching */
  async getActiveConnections(orgId: string) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyMarketingConnection.findMany({ where: { orgId, status: 'active' } }),
    );
  }

  /** Mark last successful sync timestamp (best-effort) */
  async touchSyncedAt(orgId: string, provider: LoyaltyMarketingProvider): Promise<void> {
    try {
      await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyMarketingConnection.updateMany({
          where: { orgId, provider },
          data: { syncedAt: new Date() },
        }),
      );
    } catch {
      // Best-effort — never block the sync caller
    }
  }

  decryptApiKey(row: { credentials: unknown }): string {
    const creds = row.credentials as Record<string, string>;
    return this.decrypt(creds.encryptedApiKey);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toView(row: {
    provider: string;
    status: string;
    syncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    config: unknown;
  }): MarketingConnectionView {
    return {
      provider: row.provider as LoyaltyMarketingProvider,
      status: row.status,
      syncedAt: row.syncedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      config: (row.config ?? {}) as Record<string, string>,
    };
  }
}
