import { vi } from 'vitest';

type TenantCallback<T> = (tx: T) => Promise<unknown>;

/**
 * Attach withTenant / withBypassRls shims so unit tests mirror PrismaService RLS helpers.
 * Callbacks receive the same mock client (models on `prisma` are used inside `tx.*`).
 */
export function attachTenantIsolationMocks<T extends Record<string, unknown>>(prisma: T) {
  const client = prisma as T & {
    withTenant: ReturnType<typeof vi.fn>;
    withBypassRls: ReturnType<typeof vi.fn>;
  };

  client.withTenant = vi.fn(async (_orgId: string, cb: TenantCallback<T>) => cb(prisma));
  client.withBypassRls = vi.fn(async (cb: TenantCallback<T>) => cb(prisma));

  return client;
}
