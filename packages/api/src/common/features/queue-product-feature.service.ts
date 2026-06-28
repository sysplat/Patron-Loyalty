import { Injectable, NotFoundException } from '@nestjs/common';
import { hasQueueProduct } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const CACHE_TTL_SECONDS = 300;

function queueProductCacheKey(orgId: string): string {
  return `feature:queueProduct:${orgId}`;
}

@Injectable()
export class QueueProductFeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async isEnabled(orgId: string): Promise<boolean> {
    const cacheKey = queueProductCacheKey(orgId);
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { productSku: true },
    });

    const enabled = hasQueueProduct(org?.productSku);
    await this.redis.set(cacheKey, String(enabled), CACHE_TTL_SECONDS);
    return enabled;
  }

  async requireEnabled(orgId: string): Promise<void> {
    const enabled = await this.isEnabled(orgId);
    if (!enabled) {
      throw new NotFoundException('Queue management is not available for this organization.');
    }
  }

  async invalidateCache(orgId: string): Promise<void> {
    await this.redis.del(queueProductCacheKey(orgId));
  }
}
