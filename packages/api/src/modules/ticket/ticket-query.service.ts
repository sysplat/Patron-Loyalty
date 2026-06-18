import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildPaginationArgs, buildPaginationMeta } from '@queueplatform/shared';
import {
  orgLocalInclusiveRangeExclusiveEndUtc,
  orgLocalStartOfDayMinusDaysUtc,
} from '../../common/org-local-dates';
import {
  resolveBranchIanaZone,
  resolveEffectiveIanaZone,
} from '../../common/resolve-effective-timezone';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { maskCustomerName, maskCustomerPhoneE164 } from './ticket-masking.util';

export function ticketWaitingOrderBy(): Prisma.TicketOrderByWithRelationInput[] {
  return [{ position: { sort: 'asc', nulls: 'last' } }, { bookedAt: 'asc' }];
}

@Injectable()
export class TicketQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async resolveListIanaZone(
    orgId: string,
    filters: { branchId?: string; queueId?: string },
  ): Promise<string> {
    return resolveEffectiveIanaZone(
      this.prisma,
      orgId,
      { branchId: filters.branchId, queueId: filters.queueId },
      this.redis,
    );
  }

  private throwOrgDateRangeError(e: unknown): never {
    if (e instanceof Error && e.message === 'INVALID_YMD') {
      throw new BadRequestException('Dates must use yyyy-mm-dd format');
    }
    if (e instanceof Error && e.message === 'FROM_AFTER_TO') {
      throw new BadRequestException('dateFrom must be on or before dateTo');
    }
    throw e;
  }

  /** Agent console / live queue lists — preserve manual queue order when filtering active statuses. */
  private isLiveQueueStatusFilter(status?: string): boolean {
    const raw = status?.trim();
    if (!raw || raw === 'all') return false;
    const parts = raw.includes(',')
      ? raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [raw];
    const live = new Set(['waiting', 'called', 'serving']);
    return parts.some((s) => live.has(s));
  }

  async list(
    orgId: string,
    filters: {
      branchId?: string;
      queueId?: string;
      status?: string;
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      period?: 'today' | 'week';
      search?: string;
      page?: number;
      limit?: number;
      allowedBranchIds?: string[] | null;
    },
  ) {
    const { skip, take, page, limit } = buildPaginationArgs({
      page: filters.page,
      limit: filters.limit,
    });
    if (
      !filters.branchId &&
      Array.isArray(filters.allowedBranchIds) &&
      filters.allowedBranchIds.length === 0
    ) {
      return { data: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
    }
    const listTz = await this.resolveListIanaZone(orgId, {
      branchId: filters.branchId,
      queueId: filters.queueId,
    });
    const where: Prisma.TicketWhereInput = { orgId };
    if (filters.branchId) {
      where.branchId = filters.branchId;
    } else if (filters.allowedBranchIds && filters.allowedBranchIds.length > 0) {
      where.branchId = { in: filters.allowedBranchIds };
    }
    if (filters.queueId) where.queueId = filters.queueId;

    const search = filters.search?.trim();
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { displayNumber: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerPhone: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (filters.status && filters.status.trim() !== '' && filters.status.trim() !== 'all') {
      const raw = filters.status.trim();
      if (raw.includes(',')) {
        const parts = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length > 0) {
          where.status = parts.length === 1 ? parts[0] : { in: parts };
        }
      } else {
        where.status = raw;
      }
    }

    let orderBy: Prisma.TicketOrderByWithRelationInput[] = ticketWaitingOrderBy();
    const preserveQueueOrder =
      Boolean(filters.queueId) && this.isLiveQueueStatusFilter(filters.status);

    if (filters.period === 'week') {
      const lookbackStart = orgLocalStartOfDayMinusDaysUtc(listTz, 6);
      where.bookedAt = { gte: lookbackStart };
      if (!preserveQueueOrder) {
        orderBy = [{ bookedAt: 'desc' }];
      }
    } else if (filters.period === 'today') {
      const todayStart = orgLocalStartOfDayMinusDaysUtc(listTz, 0);
      where.bookedAt = { gte: todayStart };
    }

    const df = filters.dateFrom?.trim();
    const dt = filters.dateTo?.trim();
    if ((df && !dt) || (!df && dt)) {
      throw new BadRequestException('dateFrom and dateTo must both be provided together');
    }
    const hasRange = Boolean(df && dt);
    if (hasRange) {
      if (filters.date?.trim()) {
        throw new BadRequestException('Use either date or dateFrom/dateTo, not both');
      }
      let start: Date;
      let endExclusive: Date;
      try {
        const r = orgLocalInclusiveRangeExclusiveEndUtc(listTz, df!, dt!);
        start = r.start;
        endExclusive = r.endExclusive;
      } catch (e) {
        this.throwOrgDateRangeError(e);
      }
      const rangeMs = endExclusive.getTime() - start.getTime();
      const maxMs = 366 * 24 * 60 * 60 * 1000;
      if (rangeMs > maxMs) {
        throw new BadRequestException('Date range cannot exceed 366 days');
      }
      where.bookedAt = { gte: start, lt: endExclusive };
      if (!preserveQueueOrder) {
        orderBy = [{ bookedAt: 'desc' }];
      }
    } else if (filters.date?.trim()) {
      const d = filters.date!.trim();
      let start: Date;
      let endExclusive: Date;
      try {
        const r = orgLocalInclusiveRangeExclusiveEndUtc(listTz, d, d);
        start = r.start;
        endExclusive = r.endExclusive;
      } catch (e) {
        this.throwOrgDateRangeError(e);
      }
      where.bookedAt = { gte: start, lt: endExclusive };
    }

    const [data, total] = await this.prisma.withTenant(orgId, async (tx) => {
      return Promise.all([
        tx.ticket.findMany({
          where,
          include: {
            queue: { select: { id: true, name: true, prefix: true } },
            service: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            servedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy,
          skip,
          take,
        }),
        tx.ticket.count({ where }),
      ]);
    });
    const paginationMeta = buildPaginationMeta({ page, limit, total });
    const usesCalendarScope =
      filters.period === 'today' ||
      filters.period === 'week' ||
      Boolean(filters.date?.trim()) ||
      Boolean(filters.dateFrom?.trim() && filters.dateTo?.trim());
    return {
      data,
      meta: usesCalendarScope ? { ...paginationMeta, timezone: listTz } : paginationMeta,
    };
  }

  async listForPrincipal(
    orgId: string,
    userId: string,
    filters: {
      branchId?: string;
      queueId?: string;
      status?: string;
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      period?: 'today' | 'week';
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (filters.branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(filters.branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
    }
    if (filters.queueId && allowed !== null) {
      const queue = await this.prisma.withTenant(orgId, (tx) =>
        tx.queue.findFirst({
          where: { id: filters.queueId, orgId },
          select: { branchId: true },
        }),
      );
      if (!queue) {
        throw new NotFoundException('Queue not found');
      }
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(queue.branchId))) {
        throw new ForbiddenException('Queue not in your scope');
      }
    }
    return this.list(orgId, { ...filters, allowedBranchIds: allowed });
  }

  async getById(orgId: string, ticketId: string) {
    const ticket = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.findFirst({
        where: { id: ticketId, orgId },
        include: {
          queue: { select: { id: true, name: true, prefix: true, status: true } },
          service: { select: { id: true, name: true, description: true } },
          branch: { select: { id: true, name: true, address: true, timezone: true } },
          servedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    );
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async getByDisplayNumber(orgId: string, branchId: string, displayNumber: string) {
    const dayStart = orgLocalStartOfDayMinusDaysUtc(
      await resolveBranchIanaZone(this.prisma, orgId, branchId, this.redis),
      0,
    );

    const ticket = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.findFirst({
        where: {
          orgId,
          branchId,
          displayNumber,
          bookedAt: { gte: dayStart },
        },
        include: {
          queue: { select: { id: true, name: true, prefix: true } },
          service: { select: { id: true, name: true } },
        },
      }),
    );
    if (!ticket) throw new NotFoundException('Ticket not found');

    const customerPhoneMasked = maskCustomerPhoneE164(ticket.customerPhone);
    const customerNameMasked = maskCustomerName(ticket.customerName);

    const {
      customerPhone: _omitPhone,
      customerEmail: _omitEmail,
      customerName: _omitName,
      note: _omitNote,
      metadata: _omitMetadata,
      ...safeTicket
    } = ticket;

    return {
      ...safeTicket,
      customerPhoneMasked,
      customerNameMasked,
    };
  }

  async listSmsConsentAudit(
    orgId: string,
    opts?: { page?: number; limit?: number },
  ): Promise<{
    data: Array<{
      id: string;
      action: string;
      resourceId: string | null;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
    }>;
    page: number;
    limit: number;
    total: number;
    pages: number;
  }> {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
    const skip = (page - 1) * limit;
    const where = {
      orgId,
      resourceType: 'customer_consent',
      action: { in: ['consent.sms.captured', 'consent.sms.updated'] },
    };

    return this.prisma.withTenant(orgId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.activityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            action: true,
            resourceId: true,
            metadata: true,
            createdAt: true,
          },
        }),
        tx.activityLog.count({ where }),
      ]);

      return {
        data: rows,
        page,
        limit,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      };
    });
  }
}
