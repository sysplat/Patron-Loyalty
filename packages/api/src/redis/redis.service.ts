import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;
  private logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('app.redis.url') || 'redis://localhost:6379';
    // Fail fast when Redis is unreachable/flapping. This client is for caching and
    // pub/sub only (BullMQ has its own connection in app.module), so a sick Redis must
    // never block a request for tens of seconds. `commandTimeout` bounds each command,
    // and a finite `maxRetriesPerRequest` stops commands queueing/retrying forever.
    const commandTimeout = this.configService.get<number>('app.redis.commandTimeoutMs') ?? 2000;
    this.client = new Redis(redisUrl, {
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      commandTimeout,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('ready', () => this.logger.log('Redis ready'));
    this.client.on('error', (err) => this.logger.error('Redis error:', err.message));
    this.client.on('close', () => this.logger.warn('Redis connection closed'));
  }

  getClient(): Redis {
    return this.client;
  }

  /**
   * Runs a best-effort Redis op. When Redis is unreachable/timing out, this resolves to
   * `fallback` instead of throwing, so caching and pub/sub never break a request. Strict
   * operations that need correctness (e.g. `incr` for counters) must not use this.
   */
  private async bestEffort<T>(label: string, op: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await op();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Redis ${label} failed (best-effort, ignoring): ${detail}`);
      return fallback;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.bestEffort('get', () => this.client.get(key), null);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.bestEffort(
      'set',
      async () => {
        if (ttlSeconds) {
          await this.client.setex(key, ttlSeconds, value);
        } else {
          await this.client.set(key, value);
        }
      },
      undefined,
    );
  }

  async del(key: string): Promise<void> {
    await this.bestEffort('del', () => this.client.del(key), 0);
  }

  /** Strict counter — callers depend on the returned value (rate limits, caps). Throws on failure. */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    return this.bestEffort(
      'getJson',
      async () => {
        const val = await this.client.get(key);
        return val ? (JSON.parse(val) as T) : null;
      },
      null,
    );
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /**
   * Batch-read JSON values in a single round-trip (MGET). Use this instead of
   * `Promise.all(keys.map(getJson))` for fan-out reads (e.g. queue list stats).
   * Returns one entry per key, `null` where the key is missing or unparseable.
   */
  async mgetJson<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    return this.bestEffort(
      'mgetJson',
      async () => {
        const values = await this.client.mget(...keys);
        return values.map((val) => {
          if (val == null) return null;
          try {
            return JSON.parse(val) as T;
          } catch {
            return null;
          }
        });
      },
      keys.map(() => null),
    );
  }

  /**
   * Notify public track pages (SSE) that queue state may have changed.
   * Uses Redis pub/sub channel `track:queue:{queueId}` — one publish per unique queue id.
   */
  async publishTrackQueues(queueIds: string[]): Promise<void> {
    const uniq = [...new Set(queueIds.map((id) => id.trim()).filter(Boolean))];
    if (uniq.length === 0) return;

    const payload = JSON.stringify({ type: 'queue-changed', ts: Date.now() });
    await this.bestEffort(
      'publishTrackQueues',
      () => Promise.all(uniq.map((id) => this.client.publish(`track:queue:${id}`, payload))),
      [],
    );
  }

  /**
   * Notify public multi-step visit track pages (SSE) that journey state may have changed.
   * Uses Redis pub/sub channel `track:visit:{visitId}`.
   */
  async publishTrackVisits(visitIds: string[]): Promise<void> {
    const uniq = [...new Set(visitIds.map((id) => id.trim()).filter(Boolean))];
    if (uniq.length === 0) return;

    const payload = JSON.stringify({ type: 'visit-changed', ts: Date.now() });
    await this.bestEffort(
      'publishTrackVisits',
      () => Promise.all(uniq.map((id) => this.client.publish(`track:visit:${id}`, payload))),
      [],
    );
  }

  /** Separate ioredis connection required for SUBSCRIBE (must not share the command connection). */
  duplicateForSubscribe(): Redis {
    return this.client.duplicate();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
