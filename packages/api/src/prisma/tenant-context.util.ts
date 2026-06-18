import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Run a callback with tenant RLS context for the given organization. */
export function withOrgTenant<T>(
  prisma: PrismaService,
  orgId: string,
  callback: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return prisma.withTenant(orgId, callback);
}

/** Run a callback with RLS bypass (login, public lookups, platform paths). */
export function withRlsBypass<T>(
  prisma: PrismaService,
  callback: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return prisma.withBypassRls(callback);
}
