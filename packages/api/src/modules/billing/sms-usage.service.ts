import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  BILLABLE_SMS_NOTIFICATION_STATUSES,
  isBillableSmsProviderMessageId,
  smsLifetimeUsageKey,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Tracks billable SMS usage from the database (provider-accepted sends only).
 * Redis mirrors the DB count for fast reads; DB is the source of truth.
 */
@Injectable()
export class SmsUsageService {
  private readonly logger = new Logger(SmsUsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Count SMS rows that reached the provider (Twilio `SM…` sid, status sent/delivered). */
  async countBillableFromDb(orgId: string): Promise<number> {
    return this.prisma.withTenant(orgId, async (tx) =>
      tx.notification.count({
        where: {
          orgId,
          channel: 'sms',
          status: { in: [...BILLABLE_SMS_NOTIFICATION_STATUSES] },
          providerMessageId: { startsWith: 'SM' },
        },
      }),
    );
  }

  /** In-flight SMS not yet accepted or rejected by the provider. */
  async countPendingSms(orgId: string): Promise<number> {
    return this.prisma.withTenant(orgId, async (tx) =>
      tx.notification.count({
        where: {
          orgId,
          channel: 'sms',
          status: 'pending',
        },
      }),
    );
  }

  /** Returns billable SMS used; syncs Redis cache when it drifts from DB. */
  async getUsedCount(orgId: string): Promise<number> {
    const usageKey = smsLifetimeUsageKey(orgId);
    const cached = await this.redis.get(usageKey);

    if (cached !== null && cached !== '') {
      const cachedNum = Number.parseInt(cached, 10);
      if (Number.isFinite(cachedNum) && cachedNum >= 0) {
        return cachedNum;
      }
    }

    const dbCount = await this.countBillableFromDb(orgId);
    await this.redis.set(usageKey, String(dbCount));
    return dbCount;
  }

  async syncUsageCacheFromDb(orgId: string): Promise<number> {
    const dbCount = await this.countBillableFromDb(orgId);
    await this.redis.set(smsLifetimeUsageKey(orgId), String(dbCount));
    return dbCount;
  }

  /**
   * Ensures the org has headroom for another SMS before enqueueing.
   * Counts provider-accepted sends plus pending jobs so bursts do not overshoot.
   */
  async assertSmsCreditsAvailable(
    orgId: string,
    creditLimit: number,
  ): Promise<{ used: number; pending: number }> {
    const [used, pending] = await Promise.all([
      this.getUsedCount(orgId),
      this.countPendingSms(orgId),
    ]);

    if (used + pending >= creditLimit) {
      throw new BadRequestException({
        code: 'SMS_CREDITS_EXHAUSTED',
        message: `SMS allowance used up (${used}${pending > 0 ? ` + ${pending} pending` : ''}/${creditLimit}). Buy more messages on Billing.`,
      });
    }

    return { used, pending };
  }

  shouldCountProviderMessage(providerMessageId: string | null | undefined): boolean {
    return isBillableSmsProviderMessageId(providerMessageId);
  }
}
