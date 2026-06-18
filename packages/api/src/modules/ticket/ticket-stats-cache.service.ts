import { Injectable, Logger } from '@nestjs/common';
import { cacheTokenForZone } from '../../common/org-local-dates';
import { resolveBranchIanaZone } from '../../common/resolve-effective-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class TicketStatsCacheService {
  private readonly logger = new Logger(TicketStatsCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getMonthlyTicketCount(orgId: string): Promise<number> {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const cacheKey = `org:${orgId}:tickets-count:${monthKey}`;

    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return parseInt(cached, 10);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.count({
        where: { orgId, bookedAt: { gte: monthStart } },
      }),
    );

    await this.redis.set(cacheKey, count.toString(), 86400 * 32);
    return count;
  }

  async incrementMonthlyTicketCount(orgId: string): Promise<void> {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const cacheKey = `org:${orgId}:tickets-count:${monthKey}`;
    await this.redis.incr(cacheKey);
  }

  async invalidateDerivedStats(orgId: string, branchId: string, queueIds: string[]): Promise<void> {
    try {
      const effectiveTz = await resolveBranchIanaZone(this.prisma, orgId, branchId, this.redis);
      const tzToken = cacheTokenForZone(effectiveTz);

      const promises = [];
      promises.push(this.redis.del(`cache:b-desks:${branchId}`));

      for (const qid of queueIds) {
        promises.push(this.redis.del(`queue:stats:v2:${qid}:today:${tzToken}`));
        promises.push(this.redis.del(`queue:stats:v2:${qid}:week:${tzToken}`));
        promises.push(this.redis.del(`cache:q-waiting-ids:v2:${qid}:${tzToken}`));
        promises.push(this.redis.del(`cache:q-waiting-ids:${qid}`));
      }
      await Promise.all(promises);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to invalidate derived stats for branch ${branchId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
