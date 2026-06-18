import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { orgLocalInclusiveRangeExclusiveEndUtc } from '../../common/org-local-dates';
import { resolveOrgIanaZone } from '../../common/resolve-org-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import type { AppointmentFilters } from './appointment.types';

@Injectable()
export class AppointmentQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, filters: AppointmentFilters) {
    const {
      branchId,
      serviceId,
      status,
      from,
      to,
      page = 1,
      limit = 20,
      allowedBranchIds,
    } = filters;
    if (!branchId && Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0) {
      return { appointments: [], total: 0, page, limit, pages: 0 };
    }
    const where: any = { orgId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    if (from && to) {
      const orgTz = await resolveOrgIanaZone(this.prisma, orgId);
      try {
        const { start, endExclusive } = orgLocalInclusiveRangeExclusiveEndUtc(orgTz, from, to);
        where.scheduledAt = { gte: start, lt: endExclusive };
      } catch (e) {
        if (e instanceof Error && e.message === 'INVALID_YMD') {
          throw new BadRequestException('from and to must be yyyy-mm-dd');
        }
        if (e instanceof Error && e.message === 'FROM_AFTER_TO') {
          throw new BadRequestException('from must be on or before to');
        }
        throw e;
      }
    } else if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to + 'T23:59:59');
    }

    const search = filters.search?.trim();
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerEmail: { contains: search, mode: 'insensitive' } },
            { customerPhone: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, appointments] = await this.prisma.withTenant(orgId, (tx) =>
      Promise.all([
        tx.appointment.count({ where }),
        tx.appointment.findMany({
          where,
          include: {
            branch: { select: { id: true, name: true } },
            service: { select: { id: true, name: true } },
            subService: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { scheduledAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]),
    );

    return { appointments, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async listForPrincipal(
    orgId: string,
    userId: string,
    filters: Omit<AppointmentFilters, 'allowedBranchIds'>,
  ) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (filters.branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(filters.branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
    }
    return this.list(orgId, { ...filters, allowedBranchIds: allowed });
  }

  async getById(orgId: string, id: string) {
    const appt = await this.prisma.withTenant(orgId, (tx) =>
      tx.appointment.findFirst({
        where: { id, orgId },
        include: {
          branch: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
          subService: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    );
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }
}
