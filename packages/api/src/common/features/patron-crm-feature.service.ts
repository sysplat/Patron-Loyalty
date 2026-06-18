import { ForbiddenException, Injectable } from '@nestjs/common';
import { hasLoyaltyProduct } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const CACHE_TTL_SECONDS = 300;

export function patronCrmFeatureCacheKey(orgId: string): string {
  return `feature:patronCrmEnabled:${orgId}`;
}

/**
 * Org-level Patron CRM gate — enabled by product SKU (loyalty/bundle) or platform toggle.
 */
@Injectable()
export class PatronCrmFeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async isEnabled(orgId: string): Promise<boolean> {
    const cacheKey = patronCrmFeatureCacheKey(orgId);
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { patronCrmEnabled: true, productSku: true },
    });

    const isEnabled = hasLoyaltyProduct(org?.productSku, org?.patronCrmEnabled);
    await this.redis.set(cacheKey, String(isEnabled), CACHE_TTL_SECONDS);
    return isEnabled;
  }

  async requireEnabled(orgId: string, message?: string): Promise<void> {
    const enabled = await this.isEnabled(orgId);
    if (!enabled) {
      throw new ForbiddenException(
        message ??
          'Patron CRM is not enabled for this organization. Contact your platform administrator to enable it.',
      );
    }
  }

  async invalidateCache(orgId: string): Promise<void> {
    await this.redis.del(patronCrmFeatureCacheKey(orgId));
  }
}
