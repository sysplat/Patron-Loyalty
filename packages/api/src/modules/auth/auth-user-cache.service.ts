import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/** Minimal user record needed to authorize a request (mirrors JwtStrategy select). */
export interface CachedAuthUser {
  id: string;
  orgId: string;
  email: string;
  status: string;
  organization: { status: string; slug: string } | null;
}

/** Redis key for a cached auth user. Exported so write paths can invalidate. */
export function authUserCacheKey(userId: string): string {
  return `auth:user:${userId}`;
}

const DEFAULT_TTL_SECONDS = 20;

/**
 * Caches the per-request JWT user lookup in Redis.
 *
 * Authenticated requests previously hit Postgres on every call (JwtStrategy →
 * `user.findUnique` + org status). That DB round-trip is now served from Redis
 * for a short TTL, removing the hottest per-request query at scale.
 *
 * Staleness is bounded two ways:
 * - short TTL (`AUTH_USER_CACHE_TTL_SECONDS`, default 20s) — set to `0` to disable
 *   caching entirely if a deployment needs instant suspension propagation;
 * - explicit {@link invalidate} calls when a user or their org changes status.
 *
 * The impersonation JWT blacklist is intentionally NOT cached — it stays a live
 * Redis check so ending an impersonation session revokes access immediately.
 */
@Injectable()
export class AuthUserCacheService {
  private readonly logger = new Logger(AuthUserCacheService.name);
  private readonly ttlSeconds: number;

  constructor(private readonly redis: RedisService) {
    const raw = process.env.AUTH_USER_CACHE_TTL_SECONDS?.trim();
    const parsed = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : DEFAULT_TTL_SECONDS;
    this.ttlSeconds = Number.isFinite(parsed) ? parsed : DEFAULT_TTL_SECONDS;
  }

  /** True when caching is active (TTL > 0). */
  get enabled(): boolean {
    return this.ttlSeconds > 0;
  }

  async get(userId: string): Promise<CachedAuthUser | null> {
    if (!this.enabled) return null;
    try {
      return await this.redis.getJson<CachedAuthUser>(authUserCacheKey(userId));
    } catch (err) {
      this.logger.debug(`Auth user cache read failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async set(user: CachedAuthUser): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.redis.setJson(authUserCacheKey(user.id), user, this.ttlSeconds);
    } catch (err) {
      this.logger.debug(
        `Auth user cache write failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.del(authUserCacheKey(userId));
    } catch (err) {
      this.logger.debug(
        `Auth user cache invalidate failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
