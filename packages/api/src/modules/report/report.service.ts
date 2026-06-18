import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  cacheTokenForZone,
  hourInOrgZone,
  orgLocalInclusiveRangeExclusiveEndUtc,
  orgLocalStartOfDayMinusDaysUtc,
} from '../../common/org-local-dates';
import { resolveBranchIanaZone } from '../../common/resolve-effective-timezone';
import { resolveOrgIanaZone } from '../../common/resolve-org-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';

/**
 * Generates analytics and reports for an organization.
 * Covers ticket throughput, wait times, branch utilization, and agent performance.
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private reportsCacheKey(
    report: string,
    orgId: string,
    scope: Record<string, string | undefined>,
  ): string {
    const suffix = Object.entries(scope)
      .map(([key, value]) => `${key}:${value ?? 'all'}`)
      .join(':');
    return `report:${report}:${orgId}:${suffix}`;
  }

  private async resolveReportIanaZone(orgId: string, branchId?: string): Promise<string> {
    if (branchId?.trim()) {
      return resolveBranchIanaZone(this.prisma, orgId, branchId.trim(), this.redis);
    }
    return resolveOrgIanaZone(this.prisma, orgId, this.redis);
  }

  /**
   * Upper bound on a single report's date span. Caps the number of ticket rows a
   * report query can scan so an over-wide range can't degrade the DB. Override
   * with `MAX_REPORT_RANGE_DAYS` (default 370 ≈ 1 year + buffer).
   */
  private get maxReportRangeDays(): number {
    const raw = process.env.MAX_REPORT_RANGE_DAYS?.trim();
    return raw && /^\d+$/.test(raw) ? Number(raw) : 370;
  }

  private buildOrgDateRange(
    orgTz: string,
    from: string,
    to: string,
  ): { start: Date; endExclusive: Date } {
    let range: { start: Date; endExclusive: Date };
    try {
      range = orgLocalInclusiveRangeExclusiveEndUtc(orgTz, from, to);
    } catch (e) {
      if (e instanceof Error && e.message === 'INVALID_YMD') {
        throw new BadRequestException('Dates must use yyyy-mm-dd format');
      }
      if (e instanceof Error && e.message === 'FROM_AFTER_TO') {
        throw new BadRequestException('from must be on or before to');
      }
      throw e;
    }

    const spanDays = (range.endExclusive.getTime() - range.start.getTime()) / 86_400_000;
    if (spanDays > this.maxReportRangeDays) {
      throw new BadRequestException(
        `Report range too large. Maximum span is ${this.maxReportRangeDays} days; narrow the from/to window.`,
      );
    }

    return range;
  }

  private roundMetric(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private percentage(part: number, total: number): number {
    if (total === 0) {
      return 0;
    }

    return this.roundMetric((part / total) * 100);
  }

  private branchWhereFragment(
    branchId?: string,
    allowedBranchIds?: string[] | null,
  ): { branchId?: string | { in: string[] } } {
    if (branchId) {
      return { branchId };
    }
    if (allowedBranchIds === null) {
      return {};
    }
    return { branchId: { in: allowedBranchIds ?? [] } };
  }

  private scopeCacheSuffix(branchId?: string, allowedBranchIds?: string[] | null): string {
    if (branchId) return branchId;
    if (allowedBranchIds === null) return 'all';
    return `in:${[...(allowedBranchIds ?? [])].sort().join(',')}`;
  }

  private deriveCompletedMetrics(ticket: {
    bookedAt: Date;
    calledAt?: Date | null;
    servedAt: Date | null;
    completedAt: Date | null;
    waitMinutes?: number | null;
    serviceMinutes?: number | null;
  }): { waitMinutes: number; serviceMinutes: number } | null {
    if (ticket.completedAt) {
      const serviceStart = ticket.servedAt || ticket.calledAt || ticket.completedAt;
      const waitMinutes = Math.max(0, (serviceStart.getTime() - ticket.bookedAt.getTime()) / 60000);
      const serviceMinutes = Math.max(
        0,
        (ticket.completedAt.getTime() - serviceStart.getTime()) / 60000,
      );

      return { waitMinutes, serviceMinutes };
    }

    if (
      ticket.waitMinutes !== null &&
      ticket.waitMinutes !== undefined &&
      ticket.serviceMinutes !== null &&
      ticket.serviceMinutes !== undefined
    ) {
      return {
        waitMinutes: Math.max(0, ticket.waitMinutes),
        serviceMinutes: Math.max(0, ticket.serviceMinutes),
      };
    }

    return null;
  }

  /**
   * Returns a today-scoped operational snapshot for the org (or a single branch).
   *
   * Throughput and rate metrics use tickets **booked since the start of the current org-local
   * calendar day** (organization timezone from `organizations.timezone`).
   * **Waiting / called / serving / activeNow / pendingNow** use the live pipeline: current
   * status counts with **no bookedAt filter**, so tickets booked on an earlier calendar day
   * still appear when they remain in queue.
   *
   * Cached in Redis for 60 seconds.
   */
  async overview(
    orgId: string,
    branchId?: string,
    allowedBranchIds?: string[] | null,
    period: 'today' | 'week' = 'today',
  ) {
    const orgTz = await this.resolveReportIanaZone(orgId, branchId);
    const tzToken = cacheTokenForZone(orgTz);
    const cacheKey = `report:overview:v5:${orgId}:${period}:${tzToken}:${this.scopeCacheSuffix(branchId, allowedBranchIds)}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const lookbackStart =
      period === 'week'
        ? orgLocalStartOfDayMinusDaysUtc(orgTz, 6)
        : orgLocalStartOfDayMinusDaysUtc(orgTz, 0);

    const dateWhere = { bookedAt: { gte: lookbackStart } };
    const baseWhere: any = {
      orgId,
      ...dateWhere,
      ...this.branchWhereFragment(branchId, allowedBranchIds),
    };

    const liveByStatusWhere: any = {
      orgId,
      ...dateWhere, // Respect period for live counts too as requested by user
      status: { in: ['waiting', 'called', 'serving'] },
      ...this.branchWhereFragment(branchId, allowedBranchIds),
    };

    // Desk count filter — matches the branch scope
    const deskWhere: any = {
      status: 'open',
      ...(branchId ? { branchId } : {}),
      ...(allowedBranchIds && allowedBranchIds.length > 0
        ? { branchId: { in: allowedBranchIds } }
        : {}),
      branch: { orgId },
    };

    // Review satisfaction filter — matches the branch scope and date range
    const reviewWhere: any = {
      orgId,
      status: { not: 'rejected' },
      createdAt: { gte: lookbackStart },
      ...(branchId ? { branchId } : {}),
      ...(allowedBranchIds && allowedBranchIds.length > 0
        ? { branchId: { in: allowedBranchIds } }
        : {}),
    };

    const [
      todayByStatusRows,
      liveByStatusRows,
      completedTickets,
      activeDesks,
      satisfactionAgg,
      allTicketsForPeakHour,
    ] = await this.prisma.withTenant(orgId, async (tx) => {
      return Promise.all([
        tx.ticket.groupBy({
          by: ['status'],
          where: baseWhere,
          _count: { _all: true },
        }),
        tx.ticket.groupBy({
          by: ['status'],
          where: liveByStatusWhere,
          _count: { _all: true },
        }),
        tx.ticket.findMany({
          where: { ...baseWhere, status: 'completed' },
          select: {
            bookedAt: true,
            calledAt: true,
            servedAt: true,
            completedAt: true,
            waitMinutes: true,
            serviceMinutes: true,
          },
        }),
        tx.desk.count({ where: deskWhere }),
        tx.review.aggregate({
          where: reviewWhere,
          _avg: { rating: true },
          _count: { _all: true },
        }),
        tx.ticket.findMany({
          where: baseWhere,
          select: { bookedAt: true },
        }),
      ]);
    });

    const todayByStatus = Object.fromEntries(
      todayByStatusRows.map((g) => [g.status, g._count._all]),
    );
    const liveByStatus = Object.fromEntries(liveByStatusRows.map((g) => [g.status, g._count._all]));
    const totalToday = todayByStatusRows.reduce((sum, g) => sum + g._count._all, 0);

    const derivedMetrics = completedTickets
      .map((ticket) => this.deriveCompletedMetrics(ticket))
      .filter(
        (metrics): metrics is { waitMinutes: number; serviceMinutes: number } => metrics !== null,
      );

    // Derive peak hour from all tickets in the period
    const hourCounts: Record<number, number> = {};
    for (const t of allTicketsForPeakHour) {
      const h = hourInOrgZone(orgTz, new Date(t.bookedAt));
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    }
    let peakHour: number | null = null;
    let peakHourCount = 0;
    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > peakHourCount) {
        peakHour = Number(hour);
        peakHourCount = count;
      }
    }

    const result = {
      timezone: orgTz,
      totalToday,
      waiting: liveByStatus['waiting'] ?? 0,
      called: liveByStatus['called'] ?? 0,
      serving: liveByStatus['serving'] ?? 0,
      completed: todayByStatus['completed'] ?? 0,
      noShow: todayByStatus['no_show'] ?? 0,
      cancelled: todayByStatus['cancelled'] ?? 0,
      activeNow: (liveByStatus['called'] ?? 0) + (liveByStatus['serving'] ?? 0),
      pendingNow: (liveByStatus['waiting'] ?? 0) + (liveByStatus['called'] ?? 0),
      completionRate: this.percentage(todayByStatus['completed'] ?? 0, totalToday),
      noShowRate: this.percentage(todayByStatus['no_show'] ?? 0, totalToday),
      cancelledRate: this.percentage(todayByStatus['cancelled'] ?? 0, totalToday),
      avgWaitMinutes: this.roundMetric(
        this.average(derivedMetrics.map((metrics) => metrics.waitMinutes)),
      ),
      avgServiceMinutes: this.roundMetric(
        this.average(derivedMetrics.map((metrics) => metrics.serviceMinutes)),
      ),
      activeDesks,
      satisfactionRate:
        satisfactionAgg._count._all > 0 ? this.roundMetric(satisfactionAgg._avg.rating ?? 0) : null,
      satisfactionCount: satisfactionAgg._count._all,
      peakHour,
      peakHourCount,
    };

    await this.redis.setJson(cacheKey, result, 60);
    return result;
  }

  async ticketsByHour(
    orgId: string,
    date: string,
    branchId?: string,
    allowedBranchIds?: string[] | null,
  ) {
    const orgTz = await this.resolveReportIanaZone(orgId, branchId);
    const tzToken = cacheTokenForZone(orgTz);
    const cacheKey = this.reportsCacheKey('ticketsByHour', orgId, {
      date,
      tz: tzToken,
      branchId: this.scopeCacheSuffix(branchId, allowedBranchIds),
    });
    const cached = await this.redis.getJson<any[]>(cacheKey);
    if (cached) return cached;

    const { start, endExclusive } = this.buildOrgDateRange(orgTz, date, date);

    const where: any = {
      orgId,
      bookedAt: { gte: start, lt: endExclusive },
      ...this.branchWhereFragment(branchId, allowedBranchIds),
    };

    const tickets = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.ticket.findMany({
        where,
        select: { bookedAt: true, status: true },
      });
    });

    // Aggregate by hour
    const hourly: Record<number, { total: number; completed: number; noShow: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourly[h] = { total: 0, completed: 0, noShow: 0 };
    }
    for (const t of tickets) {
      const h = hourInOrgZone(orgTz, new Date(t.bookedAt));
      hourly[h].total++;
      if (t.status === 'completed') hourly[h].completed++;
      if (t.status === 'no_show') hourly[h].noShow++;
    }

    const result = Object.entries(hourly).map(([hour, data]) => ({ hour: +hour, ...data }));
    await this.redis.setJson(cacheKey, result, 60);
    return result;
  }

  async servicePerformance(
    orgId: string,
    from: string,
    to: string,
    branchId?: string,
    allowedBranchIds?: string[] | null,
  ) {
    const orgTz = await this.resolveReportIanaZone(orgId, branchId);
    const tzToken = cacheTokenForZone(orgTz);
    const cacheKey = this.reportsCacheKey('servicePerformance', orgId, {
      from,
      to,
      tz: tzToken,
      branchId: this.scopeCacheSuffix(branchId, allowedBranchIds),
    });
    const cached = await this.redis.getJson<any[]>(cacheKey);
    if (cached) return cached;

    const { start, endExclusive } = this.buildOrgDateRange(orgTz, from, to);
    const where: any = {
      orgId,
      bookedAt: { gte: start, lt: endExclusive },
      status: 'completed',
      ...this.branchWhereFragment(branchId, allowedBranchIds),
    };

    const [tickets, serviceMap] = await this.prisma.withTenant(orgId, async (tx) => {
      const tkts = await tx.ticket.findMany({
        where,
        select: {
          serviceId: true,
          bookedAt: true,
          calledAt: true,
          servedAt: true,
          completedAt: true,
          waitMinutes: true,
          serviceMinutes: true,
        },
      });
      const sids = [...new Set(tkts.map((ticket) => ticket.serviceId))];
      const smap = await tx.service.findMany({
        where: { orgId, id: { in: sids } },
        select: { id: true, name: true },
      });
      return [tkts, smap] as const;
    });

    const nameMap = new Map(serviceMap.map((s) => [s.id, s.name]));

    const grouped = new Map<
      string,
      { ticketCount: number; metrics: Array<{ waitMinutes: number; serviceMinutes: number }> }
    >();
    for (const ticket of tickets) {
      const current = grouped.get(ticket.serviceId) ?? { ticketCount: 0, metrics: [] };
      current.ticketCount++;

      const metrics = this.deriveCompletedMetrics(ticket);
      if (metrics) {
        current.metrics.push(metrics);
      }

      grouped.set(ticket.serviceId, current);
    }

    const result = Array.from(grouped.entries()).map(([serviceId, data]) => ({
      serviceId,
      serviceName: nameMap.get(serviceId) ?? 'Unknown',
      ticketCount: data.ticketCount,
      avgWaitMinutes: this.roundMetric(
        this.average(data.metrics.map((entry) => entry.waitMinutes)),
      ),
      avgServiceMinutes: this.roundMetric(
        this.average(data.metrics.map((entry) => entry.serviceMinutes)),
      ),
    }));
    await this.redis.setJson(cacheKey, result, 60);
    return result;
  }

  async staffPerformance(
    orgId: string,
    from: string,
    to: string,
    branchId?: string,
    allowedBranchIds?: string[] | null,
  ) {
    const orgTz = await this.resolveReportIanaZone(orgId, branchId);
    const tzToken = cacheTokenForZone(orgTz);
    const cacheKey = this.reportsCacheKey('staffPerformance:v2', orgId, {
      from,
      to,
      tz: tzToken,
      branchId: this.scopeCacheSuffix(branchId, allowedBranchIds),
    });
    const cached = await this.redis.getJson<any[]>(cacheKey);
    if (cached) return cached;

    const { start, endExclusive } = this.buildOrgDateRange(orgTz, from, to);
    const where: any = {
      orgId,
      bookedAt: { gte: start, lt: endExclusive },
      status: 'completed',
      servedByUserId: { not: null },
      ...this.branchWhereFragment(branchId, allowedBranchIds),
    };

    const [tickets, reviews, userMap] = await this.prisma.withTenant(orgId, async (tx) => {
      const tkts = await tx.ticket.findMany({
        where,
        select: {
          servedByUserId: true,
          bookedAt: true,
          calledAt: true,
          servedAt: true,
          completedAt: true,
          waitMinutes: true,
          serviceMinutes: true,
          customerName: true,
          customerEmail: true,
        },
      });
      const revs = await tx.review.findMany({
        where: {
          orgId,
          status: 'approved',
          createdAt: { gte: start, lt: endExclusive },
          ...this.branchWhereFragment(branchId, allowedBranchIds),
        },
        select: { rating: true, customerEmail: true, customerName: true },
      });
      const uids = [
        ...new Set(tkts.map((ticket) => ticket.servedByUserId).filter(Boolean) as string[]),
      ];
      const umap = await tx.user.findMany({
        where: { orgId, id: { in: uids } },
        select: { id: true, firstName: true, lastName: true },
      });
      return [tkts, revs, umap] as const;
    });

    const nameMap = new Map(userMap.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    const grouped = new Map<
      string,
      { ticketsServed: number; metrics: Array<{ waitMinutes: number; serviceMinutes: number }> }
    >();
    for (const ticket of tickets) {
      if (!ticket.servedByUserId) continue;

      const current = grouped.get(ticket.servedByUserId) ?? { ticketsServed: 0, metrics: [] };
      current.ticketsServed++;

      const metrics = this.deriveCompletedMetrics(ticket);
      if (metrics) {
        current.metrics.push(metrics);
      }

      grouped.set(ticket.servedByUserId, current);
    }

    // Correlate reviews to operator users by matching customer email or name
    const userRatings = new Map<string, number[]>();
    for (const review of reviews) {
      const matchedUserIds = new Set<string>();
      for (const t of tickets) {
        if (!t.servedByUserId) continue;
        const emailMatch =
          review.customerEmail &&
          t.customerEmail &&
          review.customerEmail.trim().toLowerCase() === t.customerEmail.trim().toLowerCase();
        const nameMatch =
          review.customerName &&
          t.customerName &&
          review.customerName.trim().toLowerCase() === t.customerName.trim().toLowerCase();
        if (emailMatch || nameMatch) {
          matchedUserIds.add(t.servedByUserId);
        }
      }
      for (const uid of matchedUserIds) {
        const list = userRatings.get(uid) ?? [];
        list.push(review.rating);
        userRatings.set(uid, list);
      }
    }

    const result = Array.from(grouped.entries()).map(([userId, data]) => {
      const ratings = userRatings.get(userId) ?? [];
      const satisfactionRate = ratings.length > 0 ? this.roundMetric(this.average(ratings)) : null;
      return {
        userId,
        userName: nameMap.get(userId) ?? 'Unknown',
        ticketsServed: data.ticketsServed,
        avgWaitMinutes: this.roundMetric(
          this.average(data.metrics.map((entry) => entry.waitMinutes)),
        ),
        avgServiceMinutes: this.roundMetric(
          this.average(data.metrics.map((entry) => entry.serviceMinutes)),
        ),
        satisfactionRate,
      };
    });
    await this.redis.setJson(cacheKey, result, 60);
    return result;
  }

  async dailySummary(
    orgId: string,
    from: string,
    to: string,
    branchId?: string,
    allowedBranchIds?: string[] | null,
  ) {
    const orgTz = await this.resolveReportIanaZone(orgId, branchId);
    const tzToken = cacheTokenForZone(orgTz);
    const cacheKey = this.reportsCacheKey('dailySummary', orgId, {
      from,
      to,
      tz: tzToken,
      branchId: this.scopeCacheSuffix(branchId, allowedBranchIds),
    });
    const cached = await this.redis.getJson<any[]>(cacheKey);
    if (cached) return cached;

    const { start, endExclusive } = this.buildOrgDateRange(orgTz, from, to);

    // High-performance raw SQL aggregation to avoid fetching individual tickets
    // DATE_TRUNC handles the daily bucket, AT TIME ZONE handles the org timezone conversion
    const rawData = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.$queryRaw<any[]>`
                SELECT 
                    DATE_TRUNC('day', booked_at AT TIME ZONE ${orgTz})::date as day,
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
                    COUNT(*) FILTER (WHERE status = 'no_show')::int as "noShow",
                    AVG(wait_minutes) FILTER (WHERE status = 'completed')::float as "avgWait",
                    AVG(service_minutes) FILTER (WHERE status = 'completed')::float as "avgService"
                FROM tickets
                WHERE org_id = ${orgId}::uuid
                  AND booked_at >= ${start}
                  AND booked_at < ${endExclusive}
                  ${branchId ? Prisma.sql`AND branch_id = ${branchId}::uuid` : Prisma.sql``}
                  ${allowedBranchIds && allowedBranchIds.length > 0 ? Prisma.sql`AND branch_id IN (${Prisma.join(allowedBranchIds.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.sql``}
                GROUP BY 1
                ORDER BY 1 ASC
            `;
    });

    const result = rawData.map((row) => ({
      date: row.day.toISOString().split('T')[0],
      total: row.total,
      completed: row.completed,
      noShow: row.noShow,
      avgWaitMinutes: this.roundMetric(row.avgWait || 0),
      avgServiceMinutes: this.roundMetric(row.avgService || 0),
    }));

    await this.redis.setJson(cacheKey, result, 60);
    return result;
  }

  private async resolveReportBranchScope(
    orgId: string,
    userId: string,
    branchId?: string,
  ): Promise<{ branchId?: string; allowedBranchIds?: string[] | null }> {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (branchId) {
      if (allowed !== null && !allowed.includes(branchId)) {
        throw new ForbiddenException('Branch not in your scope');
      }
      return { branchId, allowedBranchIds: undefined };
    }
    return { branchId: undefined, allowedBranchIds: allowed };
  }

  async overviewForPrincipal(
    orgId: string,
    userId: string,
    branchId?: string,
    period: 'today' | 'week' = 'today',
  ) {
    const scope = await this.resolveReportBranchScope(orgId, userId, branchId);
    return this.overview(orgId, scope.branchId, scope.allowedBranchIds, period);
  }

  async ticketsByHourForPrincipal(orgId: string, userId: string, date: string, branchId?: string) {
    const scope = await this.resolveReportBranchScope(orgId, userId, branchId);
    return this.ticketsByHour(orgId, date, scope.branchId, scope.allowedBranchIds);
  }

  async servicePerformanceForPrincipal(
    orgId: string,
    userId: string,
    from: string,
    to: string,
    branchId?: string,
  ) {
    const scope = await this.resolveReportBranchScope(orgId, userId, branchId);
    return this.servicePerformance(orgId, from, to, scope.branchId, scope.allowedBranchIds);
  }

  async staffPerformanceForPrincipal(
    orgId: string,
    userId: string,
    from: string,
    to: string,
    branchId?: string,
  ) {
    const scope = await this.resolveReportBranchScope(orgId, userId, branchId);
    return this.staffPerformance(orgId, from, to, scope.branchId, scope.allowedBranchIds);
  }

  async dailySummaryForPrincipal(
    orgId: string,
    userId: string,
    from: string,
    to: string,
    branchId?: string,
  ) {
    const scope = await this.resolveReportBranchScope(orgId, userId, branchId);
    return this.dailySummary(orgId, from, to, scope.branchId, scope.allowedBranchIds);
  }

  /**
   * Visit-level journey analytics for mixed single-flow and multi-step businesses.
   * Operational ticket reports remain unchanged; this aggregates customer-level journey times.
   */
  async visitJourney(
    orgId: string,
    from: string,
    to: string,
    branchId?: string,
    allowedBranchIds?: string[] | null,
  ) {
    const orgTz = await this.resolveReportIanaZone(orgId, branchId);
    const tzToken = cacheTokenForZone(orgTz);
    const cacheKey = this.reportsCacheKey('visitJourney', orgId, {
      from,
      to,
      tz: tzToken,
      branchId: this.scopeCacheSuffix(branchId, allowedBranchIds),
    });
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const { start, endExclusive } = this.buildOrgDateRange(orgTz, from, to);
    const visits = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.visit.findMany({
        where: {
          orgId,
          createdAt: { gte: start, lt: endExclusive },
          ...this.branchWhereFragment(branchId, allowedBranchIds),
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          tickets: {
            orderBy: [{ createdAt: 'asc' }],
            select: {
              id: true,
              status: true,
              bookedAt: true,
              calledAt: true,
              servedAt: true,
              completedAt: true,
            },
          },
        },
      });
    });

    const completedVisits = visits.filter(
      (v) => v.completedAt !== null || v.status === 'completed',
    );
    const multiStepVisits = visits.filter((v) => v.tickets.length > 1);
    const dropOffAfterFirstStep = visits.filter(
      (v) =>
        v.tickets.length === 1 &&
        ['completed', 'no_show', 'cancelled'].includes(v.tickets[0]?.status ?? ''),
    );

    const totalDurations: number[] = [];
    const counterWaitDurations: number[] = [];
    const prepWaitDurations: number[] = [];
    const pickupWaitDurations: number[] = [];

    for (const visit of visits) {
      if (visit.completedAt) {
        totalDurations.push((visit.completedAt.getTime() - visit.startedAt.getTime()) / 60000);
      }

      const first = visit.tickets[0];
      if (first) {
        const firstServeTime = first.servedAt ?? first.calledAt ?? first.completedAt;
        if (firstServeTime) {
          counterWaitDurations.push((firstServeTime.getTime() - first.bookedAt.getTime()) / 60000);
        }
      }

      const second = visit.tickets[1];
      if (first && second) {
        const prepStart = first.completedAt ?? first.servedAt ?? first.calledAt ?? first.bookedAt;
        prepWaitDurations.push((second.bookedAt.getTime() - prepStart.getTime()) / 60000);
        const secondServeTime = second.servedAt ?? second.calledAt ?? second.completedAt;
        if (secondServeTime) {
          pickupWaitDurations.push((secondServeTime.getTime() - second.bookedAt.getTime()) / 60000);
        }
      }
    }

    const result = {
      totalVisits: visits.length,
      completedVisits: completedVisits.length,
      completionRate: this.percentage(completedVisits.length, visits.length),
      multiStepVisits: multiStepVisits.length,
      multiStepRate: this.percentage(multiStepVisits.length, visits.length),
      dropOffAfterFirstStep: dropOffAfterFirstStep.length,
      dropOffRateAfterFirstStep: this.percentage(dropOffAfterFirstStep.length, visits.length),
      avgTotalVisitMinutes: this.roundMetric(this.average(totalDurations)),
      avgCounterWaitMinutes: this.roundMetric(this.average(counterWaitDurations)),
      avgPrepWaitMinutes: this.roundMetric(this.average(prepWaitDurations)),
      avgPickupWaitMinutes: this.roundMetric(this.average(pickupWaitDurations)),
    };

    await this.redis.setJson(cacheKey, result, 120);
    return result;
  }

  async visitJourneyForPrincipal(
    orgId: string,
    userId: string,
    from: string,
    to: string,
    branchId?: string,
  ) {
    const scope = await this.resolveReportBranchScope(orgId, userId, branchId);
    return this.visitJourney(orgId, from, to, scope.branchId, scope.allowedBranchIds);
  }

  /**
   * Traffic heatmap: returns a day-of-week × hour matrix of ticket counts.
   * Each cell represents the total tickets booked during that day+hour combination
   * across the date range. Used for the dashboard heatmap visualization.
   */
  async trafficHeatmap(
    orgId: string,
    from: string,
    to: string,
    branchId?: string,
    allowedBranchIds?: string[] | null,
  ) {
    const orgTz = await this.resolveReportIanaZone(orgId, branchId);
    const tzToken = cacheTokenForZone(orgTz);
    const cacheKey = this.reportsCacheKey('trafficHeatmap', orgId, {
      from,
      to,
      tz: tzToken,
      branchId: this.scopeCacheSuffix(branchId, allowedBranchIds),
    });
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const { start, endExclusive } = this.buildOrgDateRange(orgTz, from, to);
    const where: any = {
      orgId,
      bookedAt: { gte: start, lt: endExclusive },
      ...this.branchWhereFragment(branchId, allowedBranchIds),
    };

    const tickets = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.ticket.findMany({
        where,
        select: { bookedAt: true },
      });
    });

    // Build 7×24 matrix (dayOfWeek 0=Mon to 6=Sun, hour 0-23)
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const t of tickets) {
      const d = new Date(t.bookedAt);
      const hour = hourInOrgZone(orgTz, d);
      // Convert JS getDay (0=Sun) to ISO (0=Mon)
      const jsDay = d.getDay();
      const isoDay = jsDay === 0 ? 6 : jsDay - 1;
      matrix[isoDay][hour]++;
    }

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const result = {
      days,
      hours: Array.from({ length: 24 }, (_, i) => i),
      matrix,
    };

    await this.redis.setJson(cacheKey, result, 120);
    return result;
  }

  async trafficHeatmapForPrincipal(
    orgId: string,
    userId: string,
    from: string,
    to: string,
    branchId?: string,
  ) {
    const scope = await this.resolveReportBranchScope(orgId, userId, branchId);
    return this.trafficHeatmap(orgId, from, to, scope.branchId, scope.allowedBranchIds);
  }

  /**
   * Branch comparison: returns per-branch performance metrics across the date range.
   * Includes total tickets, completion rate, avg wait, avg service, and no-show rate
   * for each branch the user has access to.
   */
  async branchComparison(
    orgId: string,
    from: string,
    to: string,
    allowedBranchIds?: string[] | null,
  ) {
    const orgTz = await resolveOrgIanaZone(this.prisma, orgId, this.redis);
    const tzToken = cacheTokenForZone(orgTz);
    const cacheKey = this.reportsCacheKey('branchComparison', orgId, {
      from,
      to,
      tz: tzToken,
      branchId: this.scopeCacheSuffix(undefined, allowedBranchIds),
    });
    const cached = await this.redis.getJson<any[]>(cacheKey);
    if (cached) return cached;

    const { start, endExclusive } = this.buildOrgDateRange(orgTz, from, to);

    const branchFilter =
      allowedBranchIds && allowedBranchIds.length > 0
        ? Prisma.sql`AND branch_id IN (${Prisma.join(allowedBranchIds.map((id) => Prisma.sql`${id}::uuid`))})`
        : Prisma.sql``;

    const [rawData, reviewData] = await this.prisma.withTenant(orgId, async (tx) => {
      const rData = await tx.$queryRaw<any[]>`
                SELECT
                    t.branch_id as "branchId",
                    b.name as "branchName",
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE t.status = 'completed')::int as completed,
                    COUNT(*) FILTER (WHERE t.status = 'no_show')::int as "noShow",
                    AVG(t.wait_minutes) FILTER (WHERE t.status = 'completed')::float as "avgWait",
                    AVG(t.service_minutes) FILTER (WHERE t.status = 'completed')::float as "avgService"
                FROM tickets t
                JOIN branches b ON b.id = t.branch_id
                WHERE t.org_id = ${orgId}::uuid
                  AND t.booked_at >= ${start}
                  AND t.booked_at < ${endExclusive}
                  ${branchFilter}
                GROUP BY t.branch_id, b.name
                ORDER BY total DESC
            `;

      const revData = await tx.$queryRaw<any[]>`
                SELECT
                    branch_id as "branchId",
                    AVG(rating)::float as "avgRating",
                    COUNT(*)::int as "reviewCount"
                FROM reviews
                WHERE org_id = ${orgId}::uuid
                  AND created_at >= ${start}
                  AND created_at < ${endExclusive}
                  ${branchFilter}
                GROUP BY branch_id
            `;
      return [rData, revData] as const;
    });
    const reviewMap = new Map(reviewData.map((r) => [r.branchId, r]));

    const result = rawData.map((row) => {
      const review = reviewMap.get(row.branchId);
      return {
        branchId: row.branchId,
        branchName: row.branchName,
        total: row.total,
        completed: row.completed,
        noShow: row.noShow,
        completionRate: this.percentage(row.completed, row.total),
        noShowRate: this.percentage(row.noShow, row.total),
        avgWaitMinutes: this.roundMetric(row.avgWait || 0),
        avgServiceMinutes: this.roundMetric(row.avgService || 0),
        satisfactionRate: review ? this.roundMetric(review.avgRating) : null,
        reviewCount: review?.reviewCount ?? 0,
      };
    });

    await this.redis.setJson(cacheKey, result, 120);
    return result;
  }

  async branchComparisonForPrincipal(orgId: string, userId: string, from: string, to: string) {
    const scope = await this.resolveReportBranchScope(orgId, userId);
    return this.branchComparison(orgId, from, to, scope.allowedBranchIds);
  }
}
