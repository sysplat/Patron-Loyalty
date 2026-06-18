import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { resolveSmsCreditsLimit } from './sms-credits';
import type { SmsCreditsAllowance } from '@queueplatform/shared';
import { SmsCreditPurchaseService } from './sms-credit-purchase.service';

export type LimitKey =
  | 'maxBranches'
  | 'maxUsers'
  | 'maxQueuesPerBranch'
  | 'maxTicketsPerMonth'
  | 'maxDevices'
  | 'smsCreditsTotal';
export type FeatureKey =
  | 'hasSmsNotifications'
  | 'hasAdvancedReports'
  | 'hasCustomBranding'
  | 'hasApiAccess';

export interface LimitCheckResult {
  /** Whether the action is still permitted (current < limit) */
  allowed: boolean;
  /** Whether the current count has reached or exceeded the plan limit */
  limitReached: boolean;
  limit: number;
  current: number;
  feature: LimitKey;
}

/** Redis cache TTL for plan limit lookups (seconds). */
const LIMITS_CACHE_TTL = 300;

/**
 * Provides plan-limit checks for resource creation and feature gating.
 * Inject this service anywhere a write operation should be aware of the org's plan.
 *
 * Plan limits are cached in Redis for {@link LIMITS_CACHE_TTL} seconds to avoid
 * an extra DB round-trip on every resource-creation request.
 * Call {@link invalidateLimitsCache} after a plan change so the next request
 * reads fresh limits from the database.
 */
@Injectable()
export class PlanLimitService {
  private readonly logger = new Logger(PlanLimitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly smsCredits: SmsCreditPurchaseService,
  ) {}

  /**
   * Returns the Redis cache key used to store plan limits for an org.
   * Centralised here so callers always use the same key format.
   */
  private limitsKey(orgId: string): string {
    return `plan:limits:${orgId}`;
  }

  /**
   * Fetches an org's active plan limits JSON, with a Redis-backed cache.
   * Returns permissive defaults (`{}`) if no active subscription is found.
   */
  async getLimits(orgId: string): Promise<Record<string, number | boolean>> {
    const cached = await this.redis.getJson<Record<string, number | boolean>>(
      this.limitsKey(orgId),
    );
    if (cached !== null) return cached;

    const sub = await this.prisma.withTenant(orgId, (tx) =>
      tx.subscription.findFirst({
        where: { orgId, status: { in: ['active', 'trialing'] } },
        include: { plan: { select: { limits: true } } },
      }),
    );

    const limits = sub ? ((sub.plan.limits ?? {}) as Record<string, number | boolean>) : {};
    await this.redis.set(this.limitsKey(orgId), JSON.stringify(limits), LIMITS_CACHE_TTL);
    return limits;
  }

  /**
   * Invalidates the cached plan limits for the given org.
   * Must be called whenever the org's subscription or plan changes so that
   * subsequent `getLimits` calls reflect the new plan immediately.
   */
  async invalidateLimitsCache(orgId: string): Promise<void> {
    await this.redis.del(this.limitsKey(orgId));
  }

  /**
   * Checks whether `currentCount` is within the plan's `limitKey`.
   * Returns soft-block metadata — never throws. Callers decide how to respond.
   */
  async checkLimit(
    orgId: string,
    feature: LimitKey,
    currentCount: number,
  ): Promise<LimitCheckResult> {
    const limits = await this.getLimits(orgId);
    const limit = typeof limits[feature] === 'number' ? (limits[feature] as number) : Infinity;
    const limitReached = currentCount >= limit;

    if (limitReached) {
      this.logger.warn(`Org ${orgId} reached plan limit: ${feature} (${currentCount}/${limit})`);
    }

    return {
      allowed: !limitReached,
      limitReached,
      limit: limit === Infinity ? -1 : limit,
      current: currentCount,
      feature,
    };
  }

  /**
   * Hard-enforces a boolean feature gate — throws ForbiddenException if the feature is disabled.
   * Use for features that must never be allowed on plans without access (e.g. SMS).
   */
  async requireFeature(orgId: string, feature: FeatureKey, errorMessage?: string): Promise<void> {
    const limits = await this.getLimits(orgId);
    const enabled = limits[feature] === true;

    if (!enabled) {
      throw new ForbiddenException(
        errorMessage ??
          `Your current plan does not include access to this feature. Please upgrade to continue.`,
      );
    }
  }

  /** Plan-included lifetime SMS allowance (excludes purchased top-ups). */
  async getSmsCreditsPlanBase(orgId: string): Promise<number> {
    const sub = await this.prisma.withTenant(orgId, (tx) =>
      tx.subscription.findFirst({
        where: { orgId, status: { in: ['active', 'trialing'] } },
        include: { plan: { select: { slug: true, limits: true } } },
      }),
    );
    const limits = (sub?.plan?.limits ?? {}) as Record<string, unknown>;
    return resolveSmsCreditsLimit(limits, sub?.plan?.slug);
  }

  /** @deprecated Use getSmsCreditsAllowance().effectiveLimit */
  async getSmsCreditsLimit(orgId: string): Promise<number> {
    const allowance = await this.getSmsCreditsAllowance(orgId);
    return allowance.effectiveLimit;
  }

  /** Plan base + purchased bonus (lifetime, no calendar reset). */
  async getSmsCreditsAllowance(orgId: string): Promise<SmsCreditsAllowance> {
    return this.smsCredits.getSmsCreditsAllowance(orgId);
  }
}
