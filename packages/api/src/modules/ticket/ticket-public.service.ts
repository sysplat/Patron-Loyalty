import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RedisService } from '../../redis/redis.service';
import { cacheTokenForZone } from '../../common/org-local-dates';
import {
  branchWaitingCountWhere,
  liveQueueBookedAtFloor,
  liveQueueWaitingIdsCacheKey,
  liveQueueWaitingTicketWhere,
} from '../../common/live-queue-session';
import { resolveBranchIanaZone } from '../../common/resolve-effective-timezone';

type TicketPublicDeps = {
  prisma: PrismaService;
  redis: RedisService;
  waitingOrderBy: () => Prisma.TicketOrderByWithRelationInput[];
  maskCustomerName: (name: string | null | undefined) => string | undefined;
  maskCustomerPhoneE164: (phone: string | null | undefined) => string | undefined;
};

@Injectable()
export class TicketPublicService {
  async getTicketPublic(deps: TicketPublicDeps, ticketId: string) {
    const cacheKey = `cache:ticket-public:${ticketId}`;
    const cachedTicket = await deps.redis.getJson<any>(cacheKey);

    let orgId: string | undefined;
    if (cachedTicket) {
      orgId = cachedTicket.orgId;
    } else {
      const resolved = await deps.prisma.withBypassRls(async (tx) => {
        return tx.ticket.findUnique({
          where: { id: ticketId },
          select: { orgId: true },
        });
      });
      orgId = resolved?.orgId;
    }

    if (!orgId) throw new NotFoundException('Ticket not found');

    const organizationBranding = await deps.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, logoUrl: true },
    });

    const ticket =
      cachedTicket ??
      (await deps.prisma.withTenant(orgId, async (tx) => {
        return tx.ticket.findUnique({
          where: { id: ticketId },
          select: {
            id: true,
            orgId: true,
            displayNumber: true,
            status: true,
            deskNumber: true,
            customerName: true,
            bookedAt: true,
            calledAt: true,
            servedAt: true,
            completedAt: true,
            waitMinutes: true,
            serviceMinutes: true,
            externalRef: true,
            customerPhone: true,
            queueId: true,
            branchId: true,
            serviceId: true,
            visitId: true,
            priority: true,
            transactionalSmsAllowed: true,
            queue: {
              select: {
                id: true,
                name: true,
                journeyModeOverride: true,
                flowTemplateId: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                exceptionalCustomerNotice: true,
                exceptionalCustomerNoticeMinutes: true,
              },
            },
            service: {
              select: {
                id: true,
                name: true,
                durationMinutes: true,
                serviceEstimateLowMinutes: true,
                serviceEstimateHighMinutes: true,
                instructionalTip: true,
              },
            },
            estimatedRemainingMins: true,
          },
        });
      }));

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (!cachedTicket) {
      await deps.redis.setJson(cacheKey, ticket, 300);
    }

    let position: number | undefined;
    let waitingTotal: number | undefined;
    let isExceptionalInProgress = false;
    let exceptionalCustomerNoticeMinutes: number | null | undefined;
    let estimatedWaitMins: number | undefined;
    let estimatedWaitMax: number | undefined;

    const skipWaitEstimates = Boolean(ticket.visitId);
    if (ticket.status === 'waiting' && !skipWaitEstimates) {
      const branchTz = await resolveBranchIanaZone(deps.prisma, orgId, ticket.branchId, deps.redis);
      const bookedAtFloor = liveQueueBookedAtFloor(branchTz, 0);
      const tzToken = cacheTokenForZone(branchTz);
      const queueCacheKey = liveQueueWaitingIdsCacheKey(ticket.queueId, tzToken);
      const desksCacheKey = `cache:b-desks:${ticket.branchId}`;
      const cfgCacheKey = `cache:bs-cfg:${ticket.branchId}:${ticket.serviceId}`;
      const [waitingIds, openDesks, branchService] = await deps.prisma.withTenant(
        orgId,
        async (tx) => {
          return Promise.all([
            deps.redis.getJson<string[]>(queueCacheKey).then(async (cached) => {
              if (cached) return cached;
              const rows = await tx.ticket.findMany({
                where: liveQueueWaitingTicketWhere(ticket.queueId, bookedAtFloor),
                orderBy: deps.waitingOrderBy(),
                select: { id: true },
              });
              const ids = rows.map((r) => r.id);
              await deps.redis.setJson(queueCacheKey, ids, 60);
              return ids;
            }),
            deps.redis.getJson<any[]>(desksCacheKey).then(async (cached) => {
              if (cached) return cached;
              const rows = await tx.desk.findMany({
                where: { branchId: ticket.branchId, status: 'open' },
                select: { number: true },
              });
              await deps.redis.setJson(desksCacheKey, rows, 60);
              return rows;
            }),
            deps.redis.getJson<any>(cfgCacheKey).then(async (cached) => {
              if (cached) return cached;
              const row = await tx.branchService.findUnique({
                where: {
                  branchId_serviceId: { branchId: ticket.branchId, serviceId: ticket.serviceId },
                },
                select: {
                  customServiceEstimateLowMinutes: true,
                  customServiceEstimateHighMinutes: true,
                },
              });
              await deps.redis.setJson(cfgCacheKey, row, 3600);
              return row;
            }),
          ]);
        },
      );

      const posIndex = waitingIds.indexOf(ticket.id);
      position = posIndex !== -1 ? posIndex + 1 : undefined;
      waitingTotal = waitingIds.length;

      const cfgLow =
        branchService?.customServiceEstimateLowMinutes ??
        ticket.service?.serviceEstimateLowMinutes ??
        null;
      const cfgHigh =
        branchService?.customServiceEstimateHighMinutes ??
        ticket.service?.serviceEstimateHighMinutes ??
        null;
      const peopleAhead = Math.max(0, (position ?? 1) - 1);
      const capacity = Math.max(1, openDesks.length);

      const bandOk =
        cfgLow !== null &&
        cfgHigh !== null &&
        Number.isFinite(cfgLow) &&
        Number.isFinite(cfgHigh) &&
        cfgLow >= 1 &&
        cfgHigh >= cfgLow;
      if (bandOk) {
        const rounds = Math.ceil(peopleAhead / capacity);
        estimatedWaitMins = rounds * Math.round(cfgLow);
        estimatedWaitMax = rounds * Math.round(cfgHigh);
      }

      isExceptionalInProgress = ticket.branch?.exceptionalCustomerNotice ?? false;
      exceptionalCustomerNoticeMinutes = isExceptionalInProgress
        ? (ticket.branch?.exceptionalCustomerNoticeMinutes ?? null)
        : undefined;
    }

    const customerPhoneMasked = deps.maskCustomerPhoneE164(ticket.customerPhone);
    const customerNameMasked = deps.maskCustomerName(ticket.customerName);
    const branchPublic = ticket.branch
      ? { id: ticket.branch.id, name: ticket.branch.name }
      : undefined;

    const {
      branchId: _branchId,
      serviceId: _serviceId,
      priority: _priority,
      customerPhone: _omitPhone,
      customerName: _omitName,
      branch: _branchRow,
      ...publicTicket
    } = ticket;

    const isJourneyManaged =
      ticket.queue?.journeyModeOverride === 'visit_multi_step' || !!ticket.queue?.flowTemplateId;

    let configuredDeskNumber: string | null = null;
    if (isJourneyManaged && ticket.queueId) {
      const flowStep = await deps.prisma.withTenant(orgId, (tx) =>
        tx.branchFlowStep.findFirst({
          where: {
            orgId,
            queueId: ticket.queueId,
            template: { branchId: ticket.branchId, isActive: true },
          },
          select: { deskNumber: true },
        }),
      );
      configuredDeskNumber = flowStep?.deskNumber?.trim() || null;
    }

    return {
      ...publicTicket,
      branch: branchPublic,
      organization: organizationBranding
        ? { name: organizationBranding.name, logoUrl: organizationBranding.logoUrl }
        : undefined,
      customerPhoneMasked,
      customerNameMasked,
      position,
      estimatedWaitMins,
      estimatedWaitMax,
      waitingTotal,
      isExceptionalInProgress,
      exceptionalCustomerNoticeMinutes,
      isJourneyManaged,
      configuredDeskNumber,
    };
  }

  async getVisitPublic(deps: TicketPublicDeps, visitIdOrToken: string) {
    const resolved = await deps.prisma.withBypassRls(async (tx) => {
      return tx.visit.findFirst({
        where: {
          OR: [{ id: visitIdOrToken }, { trackingToken: visitIdOrToken }],
        },
        select: { orgId: true },
      });
    });

    if (!resolved) throw new NotFoundException('Visit not found');
    const orgId = resolved.orgId;

    const organizationBranding = await deps.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, logoUrl: true },
    });

    const visit = await deps.prisma.withTenant(orgId, async (tx) => {
      return tx.visit.findFirst({
        where: {
          OR: [{ id: visitIdOrToken }, { trackingToken: visitIdOrToken }],
        },
        select: {
          id: true,
          trackingToken: true,
          status: true,
          source: true,
          startedAt: true,
          completedAt: true,
          customerName: true,
          branch: { select: { id: true, name: true } },
          tickets: {
            orderBy: [{ createdAt: 'asc' }],
            select: {
              id: true,
              displayNumber: true,
              status: true,
              stepIndex: true,
              queueId: true,
              queue: {
                select: {
                  id: true,
                  name: true,
                  journeyModeOverride: true,
                  flowTemplateId: true,
                },
              },
              service: { select: { id: true, name: true, instructionalTip: true, icon: true } },
              deskNumber: true,
              externalRef: true,
              bookedAt: true,
              readyAt: true,
              calledAt: true,
              servedAt: true,
              completedAt: true,
            },
          },
        },
      });
    });

    if (!visit) throw new NotFoundException('Visit not found');

    const flowSteps = await deps.prisma.withTenant(orgId, (tx) =>
      tx.branchFlowStep.findMany({
        where: {
          orgId,
          template: { branchId: visit.branch.id, isActive: true },
        },
        select: { queueId: true, deskNumber: true, stepIndex: true },
        orderBy: { stepIndex: 'asc' },
      }),
    );
    const configuredDeskByQueue = new Map(
      flowSteps.map((step) => [step.queueId, step.deskNumber?.trim() || null]),
    );

    const mappedTickets = visit.tickets.map((t) => ({
      ...t,
      isJourneyManaged:
        t.queue?.journeyModeOverride === 'visit_multi_step' || !!t.queue?.flowTemplateId,
      configuredDeskNumber: configuredDeskByQueue.get(t.queueId) ?? null,
    }));

    const activeTicket =
      mappedTickets.find((t) => ['waiting', 'called', 'serving'].includes(t.status)) ?? null;

    const lastTicket = mappedTickets.at(-1) ?? null;
    const lastIsTerminal =
      lastTicket != null && ['completed', 'no_show', 'cancelled'].includes(lastTicket.status);

    const hasPickupStep = mappedTickets.some((t) => t.readyAt != null) || mappedTickets.length >= 2;
    const maxStepIndex = mappedTickets.reduce((max, t) => Math.max(max, t.stepIndex ?? 0), 0);
    const activeAtFinalStep =
      activeTicket != null &&
      ((activeTicket.stepIndex ?? 0) >= maxStepIndex || mappedTickets.length <= 1);

    let step: string;
    if (activeTicket) {
      step =
        activeTicket.status === 'waiting' &&
        hasPickupStep &&
        !activeTicket.readyAt &&
        !activeAtFinalStep
          ? 'preparing_pickup'
          : activeTicket.status === 'waiting' && hasPickupStep
            ? 'pickup_queue'
            : activeTicket.status === 'waiting'
              ? 'order_queue'
              : activeTicket.status === 'called' || activeTicket.status === 'serving'
                ? 'in_service'
                : 'done';
    } else if (visit.status === 'active' && lastIsTerminal) {
      step = 'awaiting_next_step';
    } else {
      step = 'done';
    }

    const customerNameMasked = deps.maskCustomerName(visit.customerName);
    return {
      id: visit.id,
      trackingToken: visit.trackingToken,
      status: visit.status,
      source: visit.source,
      customerNameMasked,
      branch: visit.branch,
      organization: organizationBranding
        ? { name: organizationBranding.name, logoUrl: organizationBranding.logoUrl }
        : undefined,
      startedAt: visit.startedAt,
      completedAt: visit.completedAt,
      currentStep: step,
      activeTicket,
      tickets: mappedTickets,
    };
  }

  async getPublicDisplayBoard(deps: TicketPublicDeps, branchId: string) {
    const branch = await deps.prisma.withBypassRls((tx) =>
      tx.branch.findFirst({
        where: { id: branchId },
        select: { orgId: true },
      }),
    );
    if (!branch?.orgId) {
      throw new NotFoundException('Branch not found');
    }

    const orgId = branch.orgId;
    const branchTz = await resolveBranchIanaZone(deps.prisma, orgId, branchId, deps.redis);
    const dayStart = liveQueueBookedAtFloor(branchTz, 0);

    return deps.prisma.withTenant(orgId, async (tx) => {
      const [calledRowsRaw, waitingTotal, recentlyCompletedRows, upcomingRows, openDesks] =
        await Promise.all([
          tx.ticket.findMany({
            where: {
              branchId,
              status: { in: ['called', 'serving'] },
              bookedAt: { gte: dayStart },
            },
            orderBy: [{ calledAt: 'desc' }],
            take: 20,
            select: {
              id: true,
              displayNumber: true,
              deskNumber: true,
              status: true,
              calledAt: true,
              servedAt: true,
              queue: {
                select: {
                  name: true,
                  journeyModeOverride: true,
                  flowTemplateId: true,
                },
              },
            },
          }),
          tx.ticket.count({
            where: branchWaitingCountWhere(branchId, dayStart),
          }),
          tx.ticket.findMany({
            where: {
              branchId,
              status: { in: ['completed', 'no_show'] },
              OR: [
                { completedAt: { gte: dayStart } },
                { completedAt: null, bookedAt: { gte: dayStart } },
              ],
            },
            orderBy: [{ completedAt: { sort: 'desc', nulls: 'last' } }],
            take: 12,
            select: {
              id: true,
              displayNumber: true,
              deskNumber: true,
              status: true,
              queue: {
                select: {
                  name: true,
                  journeyModeOverride: true,
                  flowTemplateId: true,
                },
              },
            },
          }),
          tx.ticket.findMany({
            where: branchWaitingCountWhere(branchId, dayStart),
            orderBy: [{ bookedAt: 'asc' }],
            take: 5,
            select: {
              id: true,
              displayNumber: true,
              status: true,
            },
          }),
          tx.desk.count({
            where: {
              branchId,
              status: 'open',
            },
          }),
        ]);

      const rank = (s: string) => (s === 'serving' ? 0 : 1);
      const calledRows = [...calledRowsRaw]
        .sort((a, b) => {
          const dr = rank(a.status) - rank(b.status);
          if (dr !== 0) return dr;
          if (a.status === 'serving') {
            return (b.servedAt?.getTime() ?? 0) - (a.servedAt?.getTime() ?? 0);
          }
          return (b.calledAt?.getTime() ?? 0) - (a.calledAt?.getTime() ?? 0);
        })
        .slice(0, 10)
        .map(({ calledAt: _c, servedAt: _s, ...row }) => row);

      const seenDisplayNumbers = new Set<string>();

      const data = calledRows
        .filter((row) => {
          if (seenDisplayNumbers.has(row.displayNumber)) return false;
          seenDisplayNumbers.add(row.displayNumber);
          return true;
        })
        .map((row) => ({
          id: row.id,
          displayNumber: row.displayNumber,
          deskNumber: row.deskNumber,
          status: row.status,
          isJourneyManaged:
            row.queue?.journeyModeOverride === 'visit_multi_step' || !!row.queue?.flowTemplateId,
          queueName: row.queue?.name,
        }));

      const upcoming = upcomingRows
        .filter((row) => {
          if (seenDisplayNumbers.has(row.displayNumber)) return false;
          seenDisplayNumbers.add(row.displayNumber);
          return true;
        })
        .map((row) => ({
          id: row.id,
          displayNumber: row.displayNumber,
          status: row.status,
        }));

      const recentlyCompleted = recentlyCompletedRows
        .filter((row) => {
          if (seenDisplayNumbers.has(row.displayNumber)) return false;
          seenDisplayNumbers.add(row.displayNumber);
          return true;
        })
        .map((row) => ({
          id: row.id,
          displayNumber: row.displayNumber,
          deskNumber: row.deskNumber,
          status: row.status,
          isJourneyManaged:
            row.queue?.journeyModeOverride === 'visit_multi_step' || !!row.queue?.flowTemplateId,
          queueName: row.queue?.name,
        }));

      return {
        data,
        recentlyCompleted,
        upcoming,
        meta: { total: waitingTotal, openDesks, orgId, branchId },
      };
    });
  }
}
