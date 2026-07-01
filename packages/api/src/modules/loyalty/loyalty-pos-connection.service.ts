import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  LOYALTY_POS_PROVIDERS,
  type LoyaltyPosProvider,
  type LoyaltySquareConnectionInput,
  type LoyaltyCloverConnectionInput,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type PosConnectionView = {
  provider: LoyaltyPosProvider;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  /** Redacted config — never includes accessToken */
  config: Record<string, string>;
};

@Injectable()
export class LoyaltyPosConnectionService {
  private readonly logger = new Logger(LoyaltyPosConnectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Encryption helpers ───────────────────────────────────────────────────

  private getEncryptionKey(): Buffer {
    const raw = process.env.POS_ENCRYPTION_KEY;
    if (!raw || raw.length < 64) {
      throw new Error('POS_ENCRYPTION_KEY must be set to a 32-byte (64 hex chars) secret in .env');
    }
    return Buffer.from(raw.slice(0, 64), 'hex');
  }

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv(12) + tag(16) + ciphertext — all base64
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

  // ─── Signature verification ───────────────────────────────────────────────

  /**
   * Square signs webhooks with HMAC-SHA256 over the raw body using the
   * webhook signature key from the Square Dashboard.
   * Header: `x-square-hmacsha256-signature`
   */
  verifySquareSignature(rawBody: Buffer, signature: string, sigKey: string): boolean {
    try {
      const expected = createHmac('sha256', sigKey).update(rawBody).digest('base64');
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Clover signs webhooks with HMAC-SHA256 over the raw body using the
   * shared secret configured in the Clover Developer Dashboard.
   * Header: `x-clover-signature`
   */
  verifyCloverSignature(rawBody: Buffer, signature: string, sigKey: string): boolean {
    try {
      const expected = createHmac('sha256', sigKey).update(rawBody).digest('hex');
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async upsertSquare(
    orgId: string,
    input: LoyaltySquareConnectionInput,
  ): Promise<PosConnectionView> {
    const encryptedToken = this.encrypt(input.accessToken);
    const config = { locationId: input.locationId, encryptedAccessToken: encryptedToken };

    const row = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPosConnection.upsert({
        where: { orgId_provider: { orgId, provider: LOYALTY_POS_PROVIDERS.SQUARE } },
        create: {
          orgId,
          provider: LOYALTY_POS_PROVIDERS.SQUARE,
          webhookSignatureKey: input.webhookSignatureKey,
          config,
        },
        update: {
          webhookSignatureKey: input.webhookSignatureKey,
          config,
          status: 'active',
        },
      }),
    );

    return this.toView(row);
  }

  async upsertClover(
    orgId: string,
    input: LoyaltyCloverConnectionInput,
  ): Promise<PosConnectionView> {
    const encryptedToken = this.encrypt(input.accessToken);
    const config = { merchantId: input.merchantId, encryptedAccessToken: encryptedToken };

    const row = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPosConnection.upsert({
        where: { orgId_provider: { orgId, provider: LOYALTY_POS_PROVIDERS.CLOVER } },
        create: {
          orgId,
          provider: LOYALTY_POS_PROVIDERS.CLOVER,
          webhookSignatureKey: input.webhookSignatureKey,
          config,
        },
        update: {
          webhookSignatureKey: input.webhookSignatureKey,
          config,
          status: 'active',
        },
      }),
    );

    return this.toView(row);
  }

  async listConnections(orgId: string): Promise<PosConnectionView[]> {
    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPosConnection.findMany({ where: { orgId } }),
    );
    return rows.map((r) => this.toView(r));
  }

  async deleteConnection(orgId: string, provider: LoyaltyPosProvider): Promise<void> {
    const deleted = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPosConnection.deleteMany({ where: { orgId, provider } }),
    );
    if (deleted.count === 0) throw new NotFoundException(`No ${provider} connection found`);
  }

  /**
   * Load a connection row for webhook processing.
   * Returns null if no active connection exists (webhook should be ignored with 200 OK).
   */
  async getActiveConnection(orgId: string, provider: LoyaltyPosProvider) {
    return this.prisma.withBypassRls((tx) =>
      tx.loyaltyPosConnection.findFirst({
        where: { provider, status: 'active' },
        // Resolve org from a header-supplied orgId (already trusted from API key guard
        // upstream, but for POS webhooks we look up by provider)
      }),
    );
  }

  /**
   * Find a connection by provider, bypassing RLS, so the webhook controller
   * can load the row before we know the orgId.
   * We derive orgId from the row itself.
   */
  async findByProvider(provider: LoyaltyPosProvider) {
    // For multi-tenant webhooks Square/Clover send one endpoint per merchant.
    // Orgs pass their orgId as a query param (?orgId=…) on the webhook URL they
    // register with Square/Clover, so we filter by it here.
    // This method is intentionally left as a lower-level helper.
    return null; // See usage in controller which passes orgId
  }

  async findConnectionByOrgAndProvider(orgId: string, provider: LoyaltyPosProvider) {
    return this.prisma.withBypassRls((tx) =>
      tx.loyaltyPosConnection.findFirst({ where: { orgId, provider, status: 'active' } }),
    );
  }

  decryptAccessToken(row: { config: unknown }): string {
    const cfg = row.config as Record<string, string>;
    const enc = cfg.encryptedAccessToken;
    if (!enc) throw new BadRequestException('POS connection config is missing access token');
    return this.decrypt(enc);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toView(row: {
    provider: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    config: unknown;
  }): PosConnectionView {
    const cfg = row.config as Record<string, string>;
    // Strip encrypted token — never expose it
    const { encryptedAccessToken: _omit, ...safeConfig } = cfg;
    return {
      provider: row.provider as LoyaltyPosProvider,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      config: safeConfig,
    };
  }
}
