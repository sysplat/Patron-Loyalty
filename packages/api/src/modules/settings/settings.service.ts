import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Manages organization-level and branch-level settings.
 * Handles operating hours, notification preferences, and display configuration.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  async getAll(orgId: string) {
    const cacheKey = `settings:${orgId}`;
    const cached = await this.redis.getJson<Record<string, any>>(cacheKey);
    if (cached) return cached;

    const settings = await this.withOrg(orgId, (tx) => tx.setting.findMany({ where: { orgId } }));
    const result: Record<string, any> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }

    await this.redis.setJson(cacheKey, result, 300); // 5 min cache
    return result;
  }

  async get(orgId: string, key: string) {
    const setting = await this.withOrg(orgId, (tx) =>
      tx.setting.findFirst({ where: { orgId, key } }),
    );
    return setting?.value ?? null;
  }

  async set(orgId: string, key: string, value: any) {
    await this.withOrg(orgId, async (tx) => {
      const existing = await tx.setting.findFirst({
        where: { orgId, key, scope: 'org' },
      });

      if (existing) {
        await tx.setting.update({
          where: { id: existing.id },
          data: { value },
        });
      } else {
        await tx.setting.create({
          data: { orgId, key, value, scope: 'org' },
        });
      }
    });

    // Invalidate cache
    await this.redis.del(`settings:${orgId}`);
    return { key, value };
  }

  async setBulk(orgId: string, settings: Record<string, any>) {
    await this.withOrg(orgId, async (tx) => {
      const keys = Object.keys(settings);
      const existingSettings = await tx.setting.findMany({
        where: { orgId, scope: 'org', key: { in: keys } },
      });
      const existingMap = new Map(existingSettings.map((s) => [s.key, s]));

      for (const [key, value] of Object.entries(settings)) {
        const existing = existingMap.get(key);
        if (existing) {
          await tx.setting.update({
            where: { id: existing.id },
            data: { value },
          });
        } else {
          await tx.setting.create({
            data: { orgId, key, value, scope: 'org' },
          });
        }
      }
    });

    await this.redis.del(`settings:${orgId}`);
    return settings;
  }

  async delete(orgId: string, key: string) {
    await this.withOrg(orgId, async (tx) => {
      const setting = await tx.setting.findFirst({ where: { orgId, key } });
      if (!setting) throw new NotFoundException('Setting not found');
      await tx.setting.delete({ where: { id: setting.id } });
    });
    await this.redis.del(`settings:${orgId}`);
  }

  // ─── Feature Flags ─────────────────────────────

  async getFeatureFlags(orgId: string) {
    return this.prisma.featureFlag.findMany({
      where: { OR: [{ orgId }, { orgId: null }] },
      orderBy: { name: 'asc' },
    });
  }

  async isFeatureEnabled(orgId: string, key: string): Promise<boolean> {
    const cacheKey = `feature:${orgId}:${key}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return cached === 'true';

    // Check org-specific override first, then global
    const orgFlag = await this.prisma.featureFlag.findFirst({ where: { orgId, name: key } });
    if (orgFlag) {
      await this.redis.set(cacheKey, String(orgFlag.enabled), 600);
      return orgFlag.enabled;
    }

    const globalFlag = await this.prisma.featureFlag.findFirst({
      where: { orgId: null, name: key },
    });
    const isEnabled = globalFlag?.enabled ?? false;
    await this.redis.set(cacheKey, String(isEnabled), 600);
    return isEnabled;
  }

  // ─── Integrations ──────────────────────────────

  async listIntegrations(orgId: string) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.integration.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async createIntegration(orgId: string, data: { type: string; config: any; status?: string }) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.integration.create({
        data: { orgId, type: data.type, config: data.config, status: data.status ?? 'active' },
      }),
    );
  }

  async updateIntegration(
    orgId: string,
    integrationId: string,
    data: Partial<{ config: any; status: string }>,
  ) {
    const int = await this.prisma.withTenant(orgId, (tx) =>
      tx.integration.findFirst({ where: { id: integrationId, orgId } }),
    );
    if (!int) throw new NotFoundException('Integration not found');
    return this.prisma.withTenant(orgId, (tx) =>
      tx.integration.update({ where: { id: integrationId }, data }),
    );
  }

  async deleteIntegration(orgId: string, integrationId: string) {
    const int = await this.prisma.withTenant(orgId, (tx) =>
      tx.integration.findFirst({ where: { id: integrationId, orgId } }),
    );
    if (!int) throw new NotFoundException('Integration not found');
    await this.prisma.withTenant(orgId, (tx) =>
      tx.integration.delete({ where: { id: integrationId } }),
    );
  }

  // ─── Webhooks ──────────────────────────────────

  async listWebhooks(orgId: string) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async createWebhook(orgId: string, data: { url: string; events: string[]; secret: string }) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.create({
        data: { orgId, url: data.url, events: data.events, secret: data.secret, status: 'active' },
      }),
    );
  }

  async deleteWebhook(orgId: string, webhookId: string) {
    const wh = await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.findFirst({ where: { id: webhookId, orgId } }),
    );
    if (!wh) throw new NotFoundException('Webhook not found');
    await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.delete({ where: { id: webhookId } }),
    );
  }
}
