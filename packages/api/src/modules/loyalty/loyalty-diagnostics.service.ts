import { Injectable } from '@nestjs/common';
import { getObservabilityRelease } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { LoyaltyConnectorObservabilityService } from './loyalty-connector-observability.service';

export type DeliveryTimelineKind =
  | 'otp'
  | 'earn'
  | 'redeem'
  | 'campaign'
  | 'notification'
  | 'provider_status';

export type DeliveryTimelineItem = {
  id: string;
  kind: DeliveryTimelineKind;
  at: string;
  status?: string;
  channel?: string;
  title: string;
  requestId?: string;
  providerMessageId?: string;
  sourceType?: string;
  sourceId?: string;
  campaignId?: string;
  campaignSendId?: string;
  notificationId?: string;
  error?: string;
};

function payloadRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

function metadataRecord(payload: unknown): Record<string, unknown> {
  const meta = payloadRecord(payload).metadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  return meta as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

@Injectable()
export class LoyaltyDiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly connectorObs: LoyaltyConnectorObservabilityService,
  ) {}

  async getSummary(orgId: string, windowHours = 24) {
    const since = new Date(Date.now() - Math.min(Math.max(windowHours, 1), 168) * 3600_000);

    const [notifications, campaigns, stuckRedemptions, lastIngest, connector4xx, health] =
      await Promise.all([
        this.prisma.withTenant(orgId, (tx) =>
          tx.notification.groupBy({
            by: ['status'],
            where: { orgId, createdAt: { gte: since } },
            _count: { _all: true },
          }),
        ),
        this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyCampaignSend.groupBy({
            by: ['status'],
            where: { orgId, createdAt: { gte: since } },
            _count: { _all: true },
          }),
        ),
        this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyRedemption.count({
            where: {
              orgId,
              status: 'pending',
              redeemedAt: { lte: new Date(Date.now() - 24 * 3600_000) },
            },
          }),
        ),
        this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyIntegrationEvent.findFirst({
            where: { orgId },
            orderBy: { createdAt: 'desc' },
            select: {
              createdAt: true,
              route: true,
              outcome: true,
              event: true,
              requestId: true,
            },
          }),
        ),
        this.connectorObs.getClientErrorCount(orgId),
        this.checkHealth(),
      ]);

    const notifCounts = Object.fromEntries(
      notifications.map((row) => [row.status, row._count._all]),
    );
    const campaignCounts = Object.fromEntries(
      campaigns.map((row) => [row.status, row._count._all]),
    );

    const failedNotifications = await this.prisma.withTenant(orgId, (tx) =>
      tx.notification.findMany({
        where: {
          orgId,
          status: { in: ['failed', 'undelivered'] },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          channel: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          providerMessageId: true,
          payload: true,
        },
      }),
    );

    return {
      windowHours,
      notifications: {
        pending: notifCounts['pending'] ?? 0,
        sent: notifCounts['sent'] ?? 0,
        delivered: notifCounts['delivered'] ?? 0,
        failed: (notifCounts['failed'] ?? 0) + (notifCounts['undelivered'] ?? 0),
      },
      campaigns: {
        queued: campaignCounts['queued'] ?? 0,
        sending: campaignCounts['sending'] ?? 0,
        sent: campaignCounts['sent'] ?? 0,
        failed: campaignCounts['failed'] ?? 0,
        skipped: campaignCounts['skipped'] ?? 0,
      },
      stuckRedemptions,
      recentFailedNotifications: failedNotifications.map((n) => {
        const meta = metadataRecord(n.payload);
        return {
          id: n.id,
          channel: n.channel,
          status: n.status,
          error: n.errorMessage ?? undefined,
          at: n.createdAt.toISOString(),
          requestId: asString(meta.requestId),
          providerMessageId: n.providerMessageId ?? undefined,
        };
      }),
      connector: {
        clientErrorCount4xx: connector4xx,
        lastIngest: lastIngest
          ? {
              at: lastIngest.createdAt.toISOString(),
              route: lastIngest.route,
              outcome: lastIngest.outcome,
              event: lastIngest.event ?? undefined,
              requestId: lastIngest.requestId ?? undefined,
            }
          : null,
      },
      health,
      release: getObservabilityRelease(),
    };
  }

  async getDeliveryTimeline(
    orgId: string,
    query: {
      customerId?: string;
      campaignId?: string;
      requestId?: string;
      limit?: number;
    },
  ): Promise<{ items: DeliveryTimelineItem[] }> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const items: DeliveryTimelineItem[] = [];

    const account = query.customerId
      ? await this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyAccount.findFirst({
            where: { orgId, customerId: query.customerId },
            include: {
              customer: { select: { id: true, phone: true, email: true, name: true } },
            },
          }),
        )
      : null;

    if (account) {
      const [ledger, redemptions, sends] = await Promise.all([
        this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyPointLedger.findMany({
            where: { orgId, accountId: account.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
        ),
        this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyRedemption.findMany({
            where: { orgId, accountId: account.id },
            orderBy: { redeemedAt: 'desc' },
            take: limit,
            include: { reward: { select: { name: true } } },
          }),
        ),
        this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyCampaignSend.findMany({
            where: {
              orgId,
              accountId: account.id,
              ...(query.campaignId ? { campaignId: query.campaignId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { campaign: { select: { id: true, name: true, channel: true } } },
          }),
        ),
      ]);

      for (const row of ledger) {
        const kind: DeliveryTimelineKind =
          row.type === 'BURN' || row.type === 'EXPIRE' ? 'redeem' : 'earn';
        items.push({
          id: `ledger:${row.id}`,
          kind,
          at: row.createdAt.toISOString(),
          status: row.type,
          title:
            row.description?.trim() || `${row.type} ${row.points > 0 ? '+' : ''}${row.points} pts`,
          sourceType: row.sourceType ?? undefined,
          sourceId: row.sourceId ?? undefined,
        });
      }

      for (const row of redemptions) {
        items.push({
          id: `redemption:${row.id}`,
          kind: 'redeem',
          at: row.redeemedAt.toISOString(),
          status: row.status,
          title: `Redemption: ${row.reward?.name ?? 'reward'}`,
          sourceType: 'reward',
          sourceId: row.rewardId,
          error: row.status === 'cancelled' ? 'cancelled' : undefined,
        });
      }

      for (const row of sends) {
        items.push({
          id: `campaign-send:${row.id}`,
          kind: 'campaign',
          at: (row.sentAt ?? row.createdAt).toISOString(),
          status: row.status,
          channel: row.campaign.channel,
          title: `Campaign: ${row.campaign.name}`,
          campaignId: row.campaignId,
          campaignSendId: row.id,
          error: row.error ?? undefined,
        });
      }

      const phone = account.customer.phone?.trim();
      const notifications = await this.prisma.withTenant(orgId, (tx) =>
        tx.notification.findMany({
          where: {
            orgId,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600_000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: {
            logs: { orderBy: { createdAt: 'asc' }, take: 20 },
          },
        }),
      );

      for (const n of notifications) {
        const meta = metadataRecord(n.payload);
        const to = asString(payloadRecord(n.payload).to);
        const customerIdMeta = asString(meta.customerId);
        const digits = phone?.replace(/\D/g, '') ?? '';
        const matchesCustomer =
          customerIdMeta === account.customerId ||
          (digits.length >= 10 &&
            to != null &&
            (to === phone || to.replace(/\D/g, '').endsWith(digits.slice(-10))));
        const matchesRequest = !query.requestId || asString(meta.requestId) === query.requestId;
        const matchesCampaign =
          !query.campaignId || asString(meta.loyaltyCampaignId) === query.campaignId;
        if (!matchesCustomer || !matchesRequest || !matchesCampaign) continue;

        const isOtp = asString(meta.type) === 'loyalty_portal_otp';
        items.push({
          id: `notification:${n.id}`,
          kind: isOtp ? 'otp' : 'notification',
          at: n.createdAt.toISOString(),
          status: n.status,
          channel: n.channel,
          title: isOtp ? 'Portal OTP SMS' : `Notification (${n.channel})`,
          requestId: asString(meta.requestId),
          providerMessageId: n.providerMessageId ?? undefined,
          campaignId: asString(meta.loyaltyCampaignId),
          campaignSendId: asString(meta.loyaltyCampaignSendId),
          notificationId: n.id,
          error: n.errorMessage ?? undefined,
        });

        for (const log of n.logs) {
          const logMeta =
            log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
              ? (log.metadata as Record<string, unknown>)
              : {};
          items.push({
            id: `provider:${log.id}`,
            kind: 'provider_status',
            at: log.createdAt.toISOString(),
            status: log.event,
            channel: n.channel,
            title: `Provider: ${log.event}`,
            requestId: asString(logMeta.requestId) ?? asString(meta.requestId),
            providerMessageId: asString(logMeta.messageSid) ?? n.providerMessageId ?? undefined,
            notificationId: n.id,
            campaignSendId: asString(meta.loyaltyCampaignSendId),
            campaignId: asString(meta.loyaltyCampaignId),
            error: asString(logMeta.errorMessage),
          });
        }
      }
    } else if (query.campaignId || query.requestId) {
      const notifications = await this.prisma.withTenant(orgId, (tx) =>
        tx.notification.findMany({
          where: { orgId },
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: { logs: { orderBy: { createdAt: 'asc' }, take: 20 } },
        }),
      );
      for (const n of notifications) {
        const meta = metadataRecord(n.payload);
        if (query.requestId && asString(meta.requestId) !== query.requestId) continue;
        if (query.campaignId && asString(meta.loyaltyCampaignId) !== query.campaignId) continue;
        items.push({
          id: `notification:${n.id}`,
          kind: asString(meta.type) === 'loyalty_portal_otp' ? 'otp' : 'notification',
          at: n.createdAt.toISOString(),
          status: n.status,
          channel: n.channel,
          title: `Notification (${n.channel})`,
          requestId: asString(meta.requestId),
          providerMessageId: n.providerMessageId ?? undefined,
          campaignId: asString(meta.loyaltyCampaignId),
          campaignSendId: asString(meta.loyaltyCampaignSendId),
          notificationId: n.id,
          error: n.errorMessage ?? undefined,
        });
        for (const log of n.logs) {
          const logMeta =
            log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
              ? (log.metadata as Record<string, unknown>)
              : {};
          items.push({
            id: `provider:${log.id}`,
            kind: 'provider_status',
            at: log.createdAt.toISOString(),
            status: log.event,
            channel: n.channel,
            title: `Provider: ${log.event}`,
            requestId: asString(logMeta.requestId) ?? asString(meta.requestId),
            providerMessageId: asString(logMeta.messageSid) ?? n.providerMessageId ?? undefined,
            notificationId: n.id,
          });
        }
      }

      if (query.campaignId) {
        const sends = await this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyCampaignSend.findMany({
            where: { orgId, campaignId: query.campaignId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { campaign: { select: { name: true, channel: true } } },
          }),
        );
        for (const row of sends) {
          items.push({
            id: `campaign-send:${row.id}`,
            kind: 'campaign',
            at: (row.sentAt ?? row.createdAt).toISOString(),
            status: row.status,
            channel: row.campaign.channel,
            title: `Campaign: ${row.campaign.name}`,
            campaignId: row.campaignId,
            campaignSendId: row.id,
            error: row.error ?? undefined,
          });
        }
      }
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { items: items.slice(0, limit) };
  }

  async listIntegrationEvents(
    orgId: string,
    query: { route?: string; outcome?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyIntegrationEvent.findMany({
        where: {
          orgId,
          ...(query.route ? { route: query.route } : {}),
          ...(query.outcome ? { outcome: query.outcome } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        route: row.route,
        event: row.event ?? undefined,
        sourceId: row.sourceId ?? undefined,
        outcome: row.outcome,
        httpStatus: row.httpStatus ?? undefined,
        durationMs: row.durationMs ?? undefined,
        requestId: row.requestId ?? undefined,
        idempotencyKey: row.idempotencyKey ?? undefined,
        redactedPayload: row.redactedPayload ?? undefined,
      })),
    };
  }

  private async checkHealth(): Promise<{
    api: 'ok' | 'degraded';
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  }> {
    const [database, redis] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.getClient().ping(),
    ]);
    const databaseStatus = database.status === 'fulfilled' ? 'ok' : 'error';
    const redisStatus = redis.status === 'fulfilled' ? 'ok' : 'error';
    return {
      api: databaseStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
      database: databaseStatus,
      redis: redisStatus,
    };
  }
}
