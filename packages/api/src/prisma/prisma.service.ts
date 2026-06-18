import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * After DDL (e.g. ALTER COLUMN type), long-lived connections can keep prepared
 * statements whose cached plans still expect old result types; Postgres then
 * raises "cached plan must not change result type". Disabling the driver's
 * statement cache avoids stale named prepared statements on those connections.
 * @see https://github.com/prisma/prisma/issues/7678
 */
function postgresUrlWithStatementCacheDisabled(connectionUrl: string): string {
  const lower = connectionUrl.toLowerCase();
  if (!lower.startsWith('postgresql://') && !lower.startsWith('postgres://')) {
    return connectionUrl;
  }
  if (/[?&]statement_cache_size=/i.test(connectionUrl)) {
    return connectionUrl;
  }
  return connectionUrl.includes('?')
    ? `${connectionUrl}&statement_cache_size=0`
    : `${connectionUrl}?statement_cache_size=0`;
}

/**
 * Appends Prisma connection-pool tuning from env when not already in the URL.
 * Sizing the pool explicitly (rather than relying on Prisma's `num_cpus * 2 + 1`
 * default) prevents pool exhaustion / "too many clients" under multi-replica load.
 *
 * - `DATABASE_CONNECTION_LIMIT` → `connection_limit` (per-instance pool size)
 * - `DATABASE_POOL_TIMEOUT` → `pool_timeout` (seconds to wait for a free connection)
 */
function postgresUrlWithPoolConfig(connectionUrl: string): string {
  const lower = connectionUrl.toLowerCase();
  if (!lower.startsWith('postgresql://') && !lower.startsWith('postgres://')) {
    return connectionUrl;
  }

  let url = connectionUrl;
  const appendParam = (name: string, value: string) => {
    if (new RegExp(`[?&]${name}=`, 'i').test(url)) return;
    url = url.includes('?') ? `${url}&${name}=${value}` : `${url}?${name}=${value}`;
  };

  const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT?.trim();
  if (connectionLimit && /^\d+$/.test(connectionLimit)) {
    appendParam('connection_limit', connectionLimit);
  }

  const poolTimeout = process.env.DATABASE_POOL_TIMEOUT?.trim();
  if (poolTimeout && /^\d+$/.test(poolTimeout)) {
    appendParam('pool_timeout', poolTimeout);
  }

  return url;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly transientRetryDelaysMs = [500, 1000, 2000, 4000] as const;

  constructor() {
    const dbUrl = process.env.APP_DATABASE_URL?.trim() || process.env.DATABASE_URL;
    super({
      ...(dbUrl
        ? {
            datasources: {
              db: { url: postgresUrlWithPoolConfig(postgresUrlWithStatementCacheDisabled(dbUrl)) },
            },
          }
        : {}),
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.retryTransientDatabaseOperation(async () => {
      await this.$connect();
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async runWithTransientRetry<T>(operation: () => Promise<T>): Promise<T> {
    return this.retryTransientDatabaseOperation(operation);
  }

  private async retryTransientDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.transientRetryDelaysMs.length) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;

        if (
          !this.isTransientDatabaseStartupError(error) ||
          attempt === this.transientRetryDelaysMs.length
        ) {
          throw error;
        }

        await this.sleep(this.transientRetryDelaysMs[attempt]);
        attempt += 1;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Transient database operation failed');
  }

  private isTransientDatabaseStartupError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();

    return [
      'the database system is starting up',
      'server closed the connection unexpectedly',
      'terminating connection due to administrator command',
      "can't reach database server",
      'connection error',
      'timed out fetching a new connection from the connection pool',
      'too many clients already',
    ].some((needle) => message.includes(needle));
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set the current organization ID for Row-Level Security.
   * Must be called inside a transaction to scope the SET LOCAL.
   */
  async setTenantContext(orgId: string) {
    await this.$executeRaw(Prisma.sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
  }

  /**
   * Execute a callback within a transaction with tenant context set.
   * This ensures RLS policies see the correct org_id.
   */
  async withTenant<T>(
    orgId: string,
    callback: (tx: PrismaClient) => Promise<T>,
    options?: { timeoutMs?: number; maxWaitMs?: number },
  ): Promise<T> {
    const timeout = options?.timeoutMs ?? 5000;
    const maxWait = options?.maxWaitMs ?? Math.min(timeout, 10000);

    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
        return callback(tx as PrismaClient);
      },
      { timeout, maxWait },
    );
  }

  /**
   * Execute a callback within a transaction with RLS bypassed.
   * Used for platform cross-tenant metrics and public ID resolution.
   */
  async withBypassRls<T>(
    callback: (tx: PrismaClient) => Promise<T>,
    options?: { timeoutMs?: number; maxWaitMs?: number; orgId?: string },
  ): Promise<T> {
    const timeout = options?.timeoutMs ?? 5000;
    const maxWait = options?.maxWaitMs ?? Math.min(timeout, 10000);

    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT set_config('app.bypass_rls', 'on', true)`);
        if (options?.orgId) {
          await tx.$executeRaw(
            Prisma.sql`SELECT set_config('app.current_org_id', ${options.orgId}, true)`,
          );
        }
        return callback(tx as PrismaClient);
      },
      { timeout, maxWait },
    );
  }

  /**
   * Clean database (for testing only).
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be used in test environment');
    }
    const models = Reflect.ownKeys(this)
      .filter((key) => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'))
      .filter((key) => typeof (this as any)[key]?.deleteMany === 'function');

    for (const model of models) {
      await (this as any)[model].deleteMany();
    }
  }
}
