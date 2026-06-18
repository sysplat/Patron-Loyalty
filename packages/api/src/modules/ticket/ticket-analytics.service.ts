import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cacheTokenForZone, orgLocalStartOfDayMinusDaysUtc } from '../../common/org-local-dates';
import {
  resolveBranchIanaZone,
  resolveEffectiveIanaZone,
} from '../../common/resolve-effective-timezone';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { EffectiveTimezoneContext } from '../../common/resolve-effective-timezone';
import type { LiveOperationsResponse } from './ticket-analytics.types';

@Injectable()
export class TicketAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getQueueStats(orgId: string, queueId: string, period: 'today' | 'week' = 'today') {
    const effectiveTz = await resolveEffectiveIanaZone(this.prisma, orgId, { queueId }, this.redis);
    const tzToken = cacheTokenForZone(effectiveTz);
    const cacheKey = `queue:stats:v2:${queueId}:${period}:${tzToken}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const lookbackStart =
      period === 'week'
        ? orgLocalStartOfDayMinusDaysUtc(effectiveTz, 6)
        : orgLocalStartOfDayMinusDaysUtc(effectiveTz, 0);

    const { todayByStatusRows, liveByStatusRows, avgWait } = await this.prisma.withTenant(
      orgId,
      async (tx) => {
        const [todayByStatusRows, liveByStatusRows] = await Promise.all([
          tx.ticket.groupBy({
            by: ['status'],
            where: { orgId, queueId, bookedAt: { gte: lookbackStart } },
            _count: { _all: true },
          }),
          tx.ticket.groupBy({
            by: ['status'],
            where: {
              orgId,
              queueId,
              status: { in: ['waiting', 'called', 'serving'] },
              bookedAt: { gte: lookbackStart },
            },
            _count: { _all: true },
          }),
        ]);
        const avgWait = await tx.ticket.aggregate({
          where: { orgId, queueId, status: 'completed', bookedAt: { gte: lookbackStart } },
          _avg: { waitMinutes: true },
        });
        return { todayByStatusRows, liveByStatusRows, avgWait };
      },
    );

    const todayByStatus = Object.fromEntries(
      todayByStatusRows.map((group) => [group.status, group._count._all]),
    );
    const liveByStatus = Object.fromEntries(
      liveByStatusRows.map((group) => [group.status, group._count._all]),
    );
    const waiting = liveByStatus['waiting'] ?? 0;
    const called = liveByStatus['called'] ?? 0;
    const serving = liveByStatus['serving'] ?? 0;
    const completed = todayByStatus['completed'] ?? 0;
    const noShow = todayByStatus['no_show'] ?? 0;
    const cancelled = todayByStatus['cancelled'] ?? 0;
    const totalToday = todayByStatusRows.reduce((sum, group) => sum + group._count._all, 0);

    const stats = {
      waitingCount: waiting,
      calledCount: called,
      servingCount: serving,
      completedCount: completed,
      noShowCount: noShow,
      cancelledCount: cancelled,
      activeCount: called + serving,
      totalToday,
      completionRate: totalToday > 0 ? Math.round((completed / totalToday) * 1000) / 10 : 0,
      noShowRate: totalToday > 0 ? Math.round((noShow / totalToday) * 1000) / 10 : 0,
      avgWaitMinutes: Math.round(avgWait._avg?.waitMinutes ?? 0),
    };

    await this.redis.setJson(cacheKey, stats, 30);
    return stats;
  }

  async getAgentPerformance(
    orgId: string,
    queueId: string,
    userId: string,
    period: 'today' | 'week' = 'today',
  ) {
    const effectiveTz = await resolveEffectiveIanaZone(this.prisma, orgId, { queueId }, this.redis);
    const lookbackStart =
      period === 'week'
        ? orgLocalStartOfDayMinusDaysUtc(effectiveTz, 6)
        : orgLocalStartOfDayMinusDaysUtc(effectiveTz, 0);

    const where: Prisma.TicketWhereInput = {
      orgId,
      queueId,
      servedByUserId: userId,
      bookedAt: { gte: lookbackStart },
    };

    const [todayByStatusRows, liveByStatusRows, timing, recentOutcomes] =
      await this.prisma.withTenant(orgId, async (tx) => {
        return Promise.all([
          tx.ticket.groupBy({
            by: ['status'],
            where,
            _count: { _all: true },
          }),
          tx.ticket.groupBy({
            by: ['status'],
            where: {
              orgId,
              queueId,
              servedByUserId: userId,
              status: { in: ['called', 'serving'] },
            },
            _count: { _all: true },
          }),
          tx.ticket.aggregate({
            where: { ...where, status: 'completed' },
            _avg: { waitMinutes: true, serviceMinutes: true },
          }),
          tx.ticket.findMany({
            where: { ...where, status: { in: ['completed', 'no_show'] } },
            select: {
              id: true,
              displayNumber: true,
              customerName: true,
              status: true,
              bookedAt: true,
              calledAt: true,
              servedAt: true,
              completedAt: true,
              waitMinutes: true,
              serviceMinutes: true,
              service: { select: { id: true, name: true } },
              queue: { select: { id: true, name: true } },
            },
            orderBy: { completedAt: 'desc' },
            take: 5,
          }),
        ]);
      });

    const todayByStatus = Object.fromEntries(
      todayByStatusRows.map((group) => [group.status, group._count._all]),
    );
    const liveByStatus = Object.fromEntries(
      liveByStatusRows.map((group) => [group.status, group._count._all]),
    );
    const completedToday = todayByStatus['completed'] ?? 0;
    const noShowToday = todayByStatus['no_show'] ?? 0;
    const activeNow = (liveByStatus['called'] ?? 0) + (liveByStatus['serving'] ?? 0);
    const totalHandled = completedToday + noShowToday;

    return {
      completedToday,
      noShowToday,
      activeNow,
      totalHandled,
      completionRate:
        totalHandled > 0 ? Math.round((completedToday / totalHandled) * 1000) / 10 : 0,
      avgWaitMinutes: Math.round(timing._avg?.waitMinutes ?? 0),
      avgServiceMinutes: Math.round(timing._avg?.serviceMinutes ?? 0),
      recentOutcomes,
    };
  }

  async getBranchAgentPerformance(
    orgId: string,
    branchId: string,
    userId: string,
    period: 'today' | 'week' = 'today',
    forJourney?: boolean,
  ) {
    const effectiveTz = await resolveBranchIanaZone(this.prisma, orgId, branchId, this.redis);
    const lookbackStart =
      period === 'week'
        ? orgLocalStartOfDayMinusDaysUtc(effectiveTz, 6)
        : orgLocalStartOfDayMinusDaysUtc(effectiveTz, 0);

    const where: Prisma.TicketWhereInput = {
      orgId,
      branchId,
      servedByUserId: userId,
      bookedAt: { gte: lookbackStart },
    };

    if (forJourney !== undefined) {
      if (forJourney) {
        where.visitId = { not: null };
      } else {
        where.visitId = null;
      }
    }

    const [todayByStatusRows, liveByStatusRows, timing, recentOutcomes] =
      await this.prisma.withTenant(orgId, async (tx) => {
        return Promise.all([
          tx.ticket.groupBy({
            by: ['status'],
            where,
            _count: { _all: true },
          }),
          tx.ticket.groupBy({
            by: ['status'],
            where: {
              orgId,
              branchId,
              servedByUserId: userId,
              status: { in: ['called', 'serving'] },
              ...(forJourney !== undefined ? { visitId: forJourney ? { not: null } : null } : {}),
            },
            _count: { _all: true },
          }),
          tx.ticket.aggregate({
            where: { ...where, status: 'completed' },
            _avg: { waitMinutes: true, serviceMinutes: true },
          }),
          tx.ticket.findMany({
            where: { ...where, status: { in: ['completed', 'no_show'] } },
            select: {
              id: true,
              displayNumber: true,
              customerName: true,
              status: true,
              bookedAt: true,
              calledAt: true,
              servedAt: true,
              completedAt: true,
              waitMinutes: true,
              serviceMinutes: true,
              service: { select: { id: true, name: true } },
              queue: { select: { id: true, name: true } },
            },
            orderBy: { completedAt: 'desc' },
            take: 5,
          }),
        ]);
      });

    const todayByStatus = Object.fromEntries(
      todayByStatusRows.map((group) => [group.status, group._count._all]),
    );
    const liveByStatus = Object.fromEntries(
      liveByStatusRows.map((group) => [group.status, group._count._all]),
    );
    const completedToday = todayByStatus['completed'] ?? 0;
    const noShowToday = todayByStatus['no_show'] ?? 0;
    const activeNow = (liveByStatus['called'] ?? 0) + (liveByStatus['serving'] ?? 0);
    const totalHandled = completedToday + noShowToday;

    return {
      completedToday,
      noShowToday,
      activeNow,
      totalHandled,
      completionRate:
        totalHandled > 0 ? Math.round((completedToday / totalHandled) * 1000) / 10 : 0,
      avgWaitMinutes: Math.round(timing._avg?.waitMinutes ?? 0),
      avgServiceMinutes: Math.round(timing._avg?.serviceMinutes ?? 0),
      recentOutcomes,
    };
  }

  async getLiveOperations(
    orgId: string,
    filters: {
      branchId?: string;
      allowedBranchIds?: string[] | null;
      period?: 'today' | 'week';
    },
  ): Promise<LiveOperationsResponse> {
    const period = filters.period || 'today';
    const tzContext: EffectiveTimezoneContext = { branchId: filters.branchId };
    const effectiveTz = await resolveEffectiveIanaZone(this.prisma, orgId, tzContext, this.redis);
    const lookbackStart =
      period === 'week'
        ? orgLocalStartOfDayMinusDaysUtc(effectiveTz, 6)
        : orgLocalStartOfDayMinusDaysUtc(effectiveTz, 0);

    const now = new Date();

    const where: Prisma.TicketWhereInput = {
      orgId,
      bookedAt: { gte: lookbackStart },
      status: { in: ['waiting', 'called', 'serving'] },
    };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    } else if (Array.isArray(filters.allowedBranchIds) && filters.allowedBranchIds.length === 0) {
      return {
        generatedAt: now.toISOString(),
        summary: {
          waiting: 0,
          called: 0,
          serving: 0,
          active: 0,
          longestWaitMinutes: 0,
          branchCount: 0,
        },
        tickets: [],
        branches: [],
      };
    } else if (filters.allowedBranchIds && filters.allowedBranchIds.length > 0) {
      where.branchId = { in: filters.allowedBranchIds };
    }

    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          queue: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
          servedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: [
          { branch: { name: 'asc' } },
          { queue: { name: 'asc' } },
          { status: 'asc' },
          { priority: 'desc' },
          { bookedAt: 'asc' },
        ],
        take: 500,
      }),
    );

    const tickets = rows.map((ticket) => {
      const waitedFrom = ticket.calledAt ?? ticket.bookedAt;
      const servedByName = ticket.servedBy
        ? `${ticket.servedBy.firstName ?? ''} ${ticket.servedBy.lastName ?? ''}`.trim() ||
          ticket.servedBy.email
        : null;

      return {
        id: ticket.id,
        displayNumber: ticket.displayNumber,
        status: ticket.status,
        branchId: ticket.branchId,
        branchName: ticket.branch?.name ?? 'Unknown branch',
        queueId: ticket.queueId,
        queueName: ticket.queue?.name ?? 'Unknown queue',
        serviceName: ticket.service?.name ?? null,
        deskNumber: ticket.deskNumber,
        customerName: ticket.customerName,
        customerPhone: ticket.customerPhone,
        source: ticket.source,
        priority: ticket.priority,
        bookedAt: ticket.bookedAt,
        calledAt: ticket.calledAt,
        servedAt: ticket.servedAt,
        waitMinutes: Math.max(0, Math.floor((now.getTime() - ticket.bookedAt.getTime()) / 60000)),
        activeMinutes:
          ticket.status === 'waiting'
            ? null
            : Math.max(0, Math.floor((now.getTime() - waitedFrom.getTime()) / 60000)),
        servedByName,
        estimatedRemainingMins: ticket.estimatedRemainingMins ?? null,
        isExceptional: ticket.isExceptional ?? false,
      };
    });

    const branchMap = new Map<string, LiveOperationsResponse['branches'][number]>();

    for (const ticket of tickets) {
      const existing = branchMap.get(ticket.branchId) ?? {
        branchId: ticket.branchId,
        branchName: ticket.branchName,
        waiting: 0,
        called: 0,
        serving: 0,
        active: 0,
        longestWaitMinutes: 0,
        tickets: [],
      };

      if (ticket.status === 'waiting') existing.waiting += 1;
      if (ticket.status === 'called') existing.called += 1;
      if (ticket.status === 'serving') existing.serving += 1;
      existing.active = existing.called + existing.serving;
      existing.longestWaitMinutes = Math.max(existing.longestWaitMinutes, ticket.waitMinutes);
      existing.tickets.push(ticket);
      branchMap.set(ticket.branchId, existing);
    }

    const waiting = tickets.filter((ticket) => ticket.status === 'waiting').length;
    const called = tickets.filter((ticket) => ticket.status === 'called').length;
    const serving = tickets.filter((ticket) => ticket.status === 'serving').length;

    return {
      generatedAt: now.toISOString(),
      summary: {
        waiting,
        called,
        serving,
        active: called + serving,
        longestWaitMinutes: tickets.reduce((max, ticket) => Math.max(max, ticket.waitMinutes), 0),
        branchCount: branchMap.size,
      },
      tickets,
      branches: [...branchMap.values()].sort((a, b) => a.branchName.localeCompare(b.branchName)),
    };
  }

  async getLiveOperationsForPrincipal(
    orgId: string,
    userId: string,
    filters: { branchId?: string; period?: 'today' | 'week' },
  ) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (filters.branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(filters.branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
    }
    return this.getLiveOperations(orgId, {
      branchId: filters.branchId,
      allowedBranchIds: filters.branchId ? undefined : allowed,
      period: filters.period,
    });
  }
}
