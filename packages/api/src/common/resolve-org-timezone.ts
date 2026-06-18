import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { normalizeOrgIanaZone } from './org-local-dates';

export async function resolveOrgIanaZone(
  prisma: PrismaService,
  orgId: string,
  redis?: RedisService,
): Promise<string> {
  const cacheKey = `org:timezone:${orgId}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });

  const tz = normalizeOrgIanaZone(org?.timezone);

  if (redis && tz) {
    await redis.set(cacheKey, tz, 600); // 10 minutes
  }

  return tz;
}
