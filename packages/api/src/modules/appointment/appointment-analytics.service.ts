import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { orgLocalInclusiveRangeExclusiveEndUtc } from '../../common/org-local-dates';
import { resolveOrgIanaZone } from '../../common/resolve-org-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';

@Injectable()
export class AppointmentAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates appointments whose `scheduledAt` falls in the inclusive organization-local
   * date range (from `organizations.timezone`). Optional branch and service narrow the cohort.
   */
  async getAnalyticsSummary(
    orgId: string,
    opts: {
      dateFrom: string;
      dateTo: string;
      branchId?: string;
      serviceId?: string;
      allowedBranchIds?: string[] | null;
    },
  ) {
    const orgTz = await resolveOrgIanaZone(this.prisma, orgId);
    let start: Date;
    let endExclusive: Date;
    try {
      const r = orgLocalInclusiveRangeExclusiveEndUtc(orgTz, opts.dateFrom, opts.dateTo);
      start = r.start;
      endExclusive = r.endExclusive;
    } catch (e) {
      if (e instanceof Error && e.message === 'INVALID_YMD') {
        throw new BadRequestException('dateFrom and dateTo must be yyyy-mm-dd');
      }
      if (e instanceof Error && e.message === 'FROM_AFTER_TO') {
        throw new BadRequestException('dateFrom must be on or before dateTo');
      }
      throw e;
    }
    const rangeMs = endExclusive.getTime() - start.getTime();
    const maxMs = 366 * 24 * 60 * 60 * 1000;
    if (rangeMs > maxMs) {
      throw new BadRequestException('Date range cannot exceed 366 days');
    }

    const branchFilter: Prisma.AppointmentWhereInput = {};
    if (opts.branchId?.trim()) {
      branchFilter.branchId = opts.branchId.trim();
    } else if (Array.isArray(opts.allowedBranchIds) && opts.allowedBranchIds.length === 0) {
      return {
        total: 0,
        dateFrom: opts.dateFrom.trim(),
        dateTo: opts.dateTo.trim(),
        byStatus: [],
        byBranch: [],
        byService: [],
      };
    } else if (opts.allowedBranchIds && opts.allowedBranchIds.length > 0) {
      branchFilter.branchId = { in: opts.allowedBranchIds };
    }

    const where: Prisma.AppointmentWhereInput = {
      orgId,
      scheduledAt: { gte: start, lt: endExclusive },
      ...branchFilter,
      ...(opts.serviceId?.trim() ? { serviceId: opts.serviceId.trim() } : {}),
    };

    const [total, byStatus, byBranchRaw, byServiceRaw] = await this.prisma.withTenant(orgId, (tx) =>
      Promise.all([
        tx.appointment.count({ where }),
        tx.appointment.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        tx.appointment.groupBy({
          by: ['branchId'],
          where,
          _count: { _all: true },
        }),
        tx.appointment.groupBy({
          by: ['serviceId'],
          where,
          _count: { _all: true },
        }),
      ]),
    );

    const branchIds = [...new Set(byBranchRaw.map((r) => r.branchId))];
    const serviceIds = [...new Set(byServiceRaw.map((r) => r.serviceId))];

    const [branchRows, serviceRows] = await Promise.all([
      branchIds.length
        ? this.prisma.withTenant(orgId, (tx) =>
            tx.branch.findMany({
              where: { id: { in: branchIds }, orgId },
              select: { id: true, name: true },
            }),
          )
        : [],
      serviceIds.length
        ? this.prisma.withTenant(orgId, (tx) =>
            tx.service.findMany({
              where: { id: { in: serviceIds }, orgId },
              select: { id: true, name: true },
            }),
          )
        : [],
    ]);

    const branchMap = new Map(branchRows.map((b) => [b.id, b.name]));
    const serviceMap = new Map(serviceRows.map((s) => [s.id, s.name]));

    const byBranch = byBranchRaw.map((row) => ({
      branchId: row.branchId,
      branchName: branchMap.get(row.branchId) ?? 'Unknown branch',
      count: row._count._all,
    }));

    const byService = byServiceRaw.map((row) => ({
      serviceId: row.serviceId,
      serviceName: serviceMap.get(row.serviceId) ?? 'Unknown service',
      count: row._count._all,
    }));

    return {
      total,
      dateFrom: opts.dateFrom.trim(),
      dateTo: opts.dateTo.trim(),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byBranch,
      byService,
    };
  }

  async getAnalyticsSummaryForPrincipal(
    orgId: string,
    userId: string,
    opts: { dateFrom: string; dateTo: string; branchId?: string; serviceId?: string },
  ) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (opts.branchId?.trim()) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(opts.branchId.trim()))) {
        throw new ForbiddenException('Branch not in your scope');
      }
    }
    return this.getAnalyticsSummary(orgId, {
      ...opts,
      allowedBranchIds: opts.branchId ? undefined : allowed,
    });
  }
}
