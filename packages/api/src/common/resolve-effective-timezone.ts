import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { normalizeOrgIanaZone } from './org-local-dates';
import { resolveOrgIanaZone } from './resolve-org-timezone';

export type EffectiveTimezoneContext = {
  branchId?: string | null;
  queueId?: string | null;
};

/**
 * IANA zone for a branch: branch.timezone with organization fallback.
 */
export async function resolveBranchIanaZone(
  prisma: PrismaService,
  orgId: string,
  branchId: string,
  redis?: RedisService,
): Promise<string> {
  const cacheKey = `branch:timezone:${branchId}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  }

  const branch = await prisma.withTenant(orgId, (tx) =>
    tx.branch.findFirst({
      where: { id: branchId, orgId },
      select: { timezone: true },
    }),
  );

  let tz: string;
  if (branch?.timezone?.trim()) {
    tz = normalizeOrgIanaZone(branch.timezone);
  } else {
    tz = await resolveOrgIanaZone(prisma, orgId, redis);
  }

  if (redis && tz) {
    await redis.set(cacheKey, tz, 600);
  }

  return tz;
}

/**
 * Operational/reporting timezone: queue → branch → org.
 * With no branch or queue context, returns organization timezone.
 */
export async function resolveEffectiveIanaZone(
  prisma: PrismaService,
  orgId: string,
  context: EffectiveTimezoneContext = {},
  redis?: RedisService,
): Promise<string> {
  let branchId = context.branchId?.trim() || null;

  if (!branchId && context.queueId?.trim()) {
    const queueId = context.queueId.trim();
    const queue = await prisma.withTenant(orgId, (tx) =>
      tx.queue.findFirst({
        where: { id: queueId, orgId },
        select: { branchId: true },
      }),
    );
    branchId = queue?.branchId ?? null;
  }

  if (branchId) {
    return resolveBranchIanaZone(prisma, orgId, branchId, redis);
  }

  return resolveOrgIanaZone(prisma, orgId, redis);
}
