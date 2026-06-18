import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const MS_7D = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class PlatformHealthService {
  private readonly logger = new Logger(PlatformHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeSnapshotForOrg(
    orgId: string,
  ): Promise<{ status: string; metrics: Record<string, unknown> }> {
    const since = new Date(Date.now() - MS_7D);
    return this.prisma.withTenant(orgId, async (tx) => {
      const terminal = await tx.ticket.groupBy({
        by: ['status'],
        where: {
          orgId,
          bookedAt: { gte: since },
          status: { in: ['completed', 'no_show', 'cancelled'] },
        },
        _count: { _all: true },
      });
      const byStatus = Object.fromEntries(terminal.map((t) => [t.status, t._count._all]));

      const completedRows = await tx.ticket.findMany({
        where: { orgId, status: 'completed', bookedAt: { gte: since }, waitMinutes: { not: null } },
        select: { waitMinutes: true },
        take: 5000,
      });
      const waits = completedRows.map((r) => r.waitMinutes!).filter((n) => typeof n === 'number');
      const avgWait =
        waits.length > 0 ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;

      const noShow = byStatus['no_show'] ?? 0;
      const completed = byStatus['completed'] ?? 0;
      const cancelled = byStatus['cancelled'] ?? 0;
      const denom = noShow + completed + cancelled;
      const noShowRate = denom > 0 ? noShow / denom : 0;

      const sub = await tx.subscription.findFirst({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      });
      const subStatus = sub?.status ?? 'none';

      const reasons: string[] = [];
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (avgWait > 90) {
        reasons.push('avg_wait_over_90m');
        status = 'unhealthy';
      }
      if (noShowRate > 0.3 && denom >= 5) {
        reasons.push('high_no_show_rate');
        if (status === 'healthy') status = 'degraded';
        if (noShowRate > 0.5) status = 'unhealthy';
      }
      if (subStatus === 'past_due' || subStatus === 'unpaid') {
        reasons.push('subscription_payment_issue');
        status = 'unhealthy';
      }

      const metrics: Record<string, unknown> = {
        windowDays: 7,
        avgWaitMinutesCompleted: avgWait,
        noShowRate: Math.round(noShowRate * 1000) / 1000,
        ticketTerminalCounts7d: byStatus,
        subscriptionStatus: subStatus,
        reasons,
      };

      await tx.orgHealthSnapshot.create({
        data: {
          orgId,
          status,
          metrics: metrics as Prisma.InputJsonValue,
        },
      });

      return { status, metrics };
    });
  }

  async computeSnapshotsForAllOrgs(): Promise<void> {
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    this.logger.log(`Computing health snapshots for ${orgs.length} orgs`);
    for (const o of orgs) {
      try {
        await this.computeSnapshotForOrg(o.id);
      } catch (e) {
        this.logger.warn(
          `Health snapshot failed for org ${o.id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  async listLatestSnapshots(skip: number, take: number) {
    const [items, total] = await this.prisma.withBypassRls((tx) =>
      Promise.all([
        tx.orgHealthSnapshot.findMany({
          orderBy: { computedAt: 'desc' },
          skip,
          take,
          include: {
            organization: { select: { id: true, name: true, slug: true } },
          },
        }),
        tx.orgHealthSnapshot.count(),
      ]),
    );
    return { items, skip, take, total };
  }
}
