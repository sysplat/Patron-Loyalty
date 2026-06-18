import { Injectable, Logger } from '@nestjs/common';
import {
  computeSmsCreditsAllowance,
  smsLifetimeBonusKey,
  type SmsCreditsAllowance,
} from '@queueplatform/shared';
import { resolveSmsCreditsLimit } from './sms-credits';
import type { SmsCreditPackDefinition } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class SmsCreditPurchaseService {
  private readonly logger = new Logger(SmsCreditPurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  resolvePackMessages(pack: SmsCreditPackDefinition): number {
    const raw = process.env[pack.messagesEnvKey];
    if (raw !== undefined && raw !== '') {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return pack.messages;
  }

  async getPurchasedBonus(orgId: string): Promise<number> {
    const cached = await this.redis.get(smsLifetimeBonusKey(orgId));
    if (cached !== null && cached !== '') {
      const n = Number.parseInt(cached, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }

    const aggregate = await this.prisma.withTenant(orgId, (tx) =>
      tx.smsCreditPurchase.aggregate({
        where: { orgId, status: 'completed' },
        _sum: { messages: true },
      }),
    );
    const total = aggregate._sum.messages ?? 0;
    await this.redis.set(smsLifetimeBonusKey(orgId), String(total));
    return total;
  }

  async getSmsCreditsAllowance(orgId: string): Promise<SmsCreditsAllowance> {
    const sub = await this.prisma.withTenant(orgId, (tx) =>
      tx.subscription.findFirst({
        where: { orgId, status: { in: ['active', 'trialing'] } },
        include: { plan: { select: { slug: true, limits: true } } },
      }),
    );
    const limits = (sub?.plan?.limits ?? {}) as Record<string, unknown>;
    const planBase = resolveSmsCreditsLimit(limits, sub?.plan?.slug);
    const purchasedBonus = await this.getPurchasedBonus(orgId);
    return computeSmsCreditsAllowance(planBase, purchasedBonus);
  }

  /**
   * Marks purchase completed and adds messages to lifetime bonus (idempotent by session id).
   */
  async completePurchase(
    stripeCheckoutSessionId: string,
  ): Promise<{ orgId: string; messages: number } | null> {
    const existing = await this.prisma.withBypassRls((tx) =>
      tx.smsCreditPurchase.findUnique({
        where: { stripeCheckoutSessionId },
      }),
    );
    if (!existing) {
      this.logger.warn(`SMS credit purchase not found for session ${stripeCheckoutSessionId}`);
      return null;
    }
    if (existing.status === 'completed') {
      return { orgId: existing.orgId, messages: 0 };
    }

    await this.prisma.withTenant(existing.orgId, (tx) =>
      tx.smsCreditPurchase.update({
        where: { id: existing.id },
        data: { status: 'completed', completedAt: new Date() },
      }),
    );

    await this.redis.getClient().incrby(smsLifetimeBonusKey(existing.orgId), existing.messages);
    return { orgId: existing.orgId, messages: existing.messages };
  }

  async sumCompletedPurchasesFromDb(orgId: string): Promise<number> {
    const aggregate = await this.prisma.withTenant(orgId, (tx) =>
      tx.smsCreditPurchase.aggregate({
        where: { orgId, status: 'completed' },
        _sum: { messages: true },
      }),
    );
    return aggregate._sum.messages ?? 0;
  }

  async syncBonusCacheFromDb(orgId: string): Promise<void> {
    const total = await this.sumCompletedPurchasesFromDb(orgId);
    await this.redis.set(smsLifetimeBonusKey(orgId), String(total));
  }
}
