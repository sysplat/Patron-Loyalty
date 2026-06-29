import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { LOYALTY_INTEGRATION_API_KEY_SETTING } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';

type StoredApiKey = {
  hash: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
};

@Injectable()
export class LoyaltyApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  private hashKey(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private generateRawKey(): string {
    return `lms_${randomBytes(32).toString('hex')}`;
  }

  async getStatus(orgId: string): Promise<{
    configured: boolean;
    prefix: string | null;
    createdAt: string | null;
    lastUsedAt: string | null;
  }> {
    const stored = await this.readStored(orgId);
    if (!stored) {
      return { configured: false, prefix: null, createdAt: null, lastUsedAt: null };
    }
    return {
      configured: true,
      prefix: stored.prefix,
      createdAt: stored.createdAt,
      lastUsedAt: stored.lastUsedAt ?? null,
    };
  }

  async rotateKey(orgId: string): Promise<{ apiKey: string; prefix: string; createdAt: string }> {
    await this.patronCrmFeature.requireEnabled(orgId);
    const raw = this.generateRawKey();
    const prefix = raw.slice(0, 12);
    const createdAt = new Date().toISOString();
    const payload: StoredApiKey = {
      hash: this.hashKey(raw),
      prefix,
      createdAt,
    };

    await this.prisma.withTenant(orgId, async (tx) => {
      const existing = await tx.setting.findFirst({
        where: { orgId, key: LOYALTY_INTEGRATION_API_KEY_SETTING, scope: 'org', scopeId: null },
      });
      if (existing) {
        await tx.setting.update({
          where: { id: existing.id },
          data: { value: payload },
        });
      } else {
        await tx.setting.create({
          data: {
            orgId,
            key: LOYALTY_INTEGRATION_API_KEY_SETTING,
            value: payload,
            scope: 'org',
          },
        });
      }
    });

    return { apiKey: raw, prefix, createdAt };
  }

  async revokeKey(orgId: string): Promise<void> {
    await this.prisma.withTenant(orgId, (tx) =>
      tx.setting.deleteMany({
        where: { orgId, key: LOYALTY_INTEGRATION_API_KEY_SETTING, scope: 'org', scopeId: null },
      }),
    );
  }

  /** Resolve org from raw API key; returns null when invalid or loyalty disabled. */
  async resolveOrgId(rawKey: string): Promise<string | null> {
    const trimmed = rawKey.trim();
    if (!trimmed.startsWith('lms_')) return null;

    const hash = this.hashKey(trimmed);
    const match = await this.prisma.withBypassRls((tx) =>
      tx.setting.findFirst({
        where: {
          key: LOYALTY_INTEGRATION_API_KEY_SETTING,
          scope: 'org',
          scopeId: null,
          value: { path: ['hash'], equals: hash },
        },
        select: { orgId: true },
      }),
    );

    if (!match) return null;

    const enabled = await this.patronCrmFeature.isEnabled(match.orgId);
    if (!enabled) return null;

    void this.touchLastUsedAt(match.orgId);
    return match.orgId;
  }

  private async touchLastUsedAt(orgId: string): Promise<void> {
    const stored = await this.readStored(orgId);
    if (!stored) return;

    const lastUsedAt = new Date().toISOString();
    const payload: StoredApiKey = { ...stored, lastUsedAt };

    try {
      await this.prisma.withTenant(orgId, async (tx) => {
        const existing = await tx.setting.findFirst({
          where: { orgId, key: LOYALTY_INTEGRATION_API_KEY_SETTING, scope: 'org', scopeId: null },
        });
        if (!existing) return;
        await tx.setting.update({
          where: { id: existing.id },
          data: { value: payload },
        });
      });
    } catch {
      // Best-effort observability — never block integration auth.
    }
  }

  private async readStored(orgId: string): Promise<StoredApiKey | null> {
    const row = await this.prisma.withTenant(orgId, (tx) =>
      tx.setting.findFirst({
        where: { orgId, key: LOYALTY_INTEGRATION_API_KEY_SETTING, scope: 'org', scopeId: null },
      }),
    );
    if (!row?.value || typeof row.value !== 'object') return null;
    return row.value as StoredApiKey;
  }
}
