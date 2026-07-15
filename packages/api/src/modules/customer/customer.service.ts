import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  CUSTOMER_SEGMENT_PRESET_LABELS,
  CUSTOMER_SEGMENT_PRESET_VALUES,
  LOYALTY_EVENTS,
  type CustomerSegmentPreset,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { CustomerSegmentService } from './customer-segment.service';
import { LoyaltyCustomerCreatedEvent } from '../loyalty/loyalty.events';
import {
  appointmentContactOr,
  mergeCustomerMetadata,
  parseCustomerMetadata,
  reviewContactOr,
  ticketContactOr,
  visitContactOr,
  type CustomerContact,
} from './customer-contact.util';

export interface CustomerListFilters {
  branchId?: string;
  search?: string;
  segment?: CustomerSegmentPreset;
  savedSegmentId?: string;
  page?: number;
  limit?: number;
}

export interface CustomerSegmentFilters {
  preset?: CustomerSegmentPreset;
  branchId?: string;
  search?: string;
}

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly segments: CustomerSegmentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  private async requireCrm(orgId: string): Promise<void> {
    await this.patronCrmFeature.requireEnabled(orgId);
  }

  async listForPrincipal(orgId: string, userId: string, filters: CustomerListFilters) {
    await this.requireCrm(orgId);
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (filters.branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(filters.branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
      return this.list(orgId, { ...filters, allowedBranchIds: undefined });
    }
    return this.list(orgId, { ...filters, allowedBranchIds: allowed });
  }

  async list(orgId: string, filters: CustomerListFilters & { allowedBranchIds?: string[] | null }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const where: Prisma.CustomerWhereInput = { orgId };

    if (Array.isArray(filters.allowedBranchIds) && filters.allowedBranchIds.length === 0) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    const segmentFilters = await this.resolveSegmentFilters(orgId, filters);
    const effectiveSegment = segmentFilters.preset;
    const effectiveBranchId = segmentFilters.branchId ?? filters.branchId;
    const effectiveSearch = segmentFilters.search ?? filters.search?.trim();

    if (effectiveSegment) {
      const presetWhere = this.segments.presetWhere(effectiveSegment);
      if (presetWhere) {
        Object.assign(where, presetWhere);
      } else {
        const ids = await this.segments.resolvePresetCustomerIds(orgId, effectiveSegment);
        const idList = ids ?? [];
        where.id = { in: idList.length > 0 ? idList : ['00000000-0000-0000-0000-000000000000'] };
      }
    }

    if (effectiveSearch) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { name: { contains: effectiveSearch, mode: 'insensitive' } },
            { email: { contains: effectiveSearch, mode: 'insensitive' } },
            { phone: { contains: effectiveSearch } },
          ],
        },
      ];
    }

    if (effectiveBranchId) {
      const branchCustomerIds = await this.findCustomerIdsForBranch(orgId, effectiveBranchId);
      const existingId = where.id;
      if (
        existingId &&
        typeof existingId === 'object' &&
        'in' in existingId &&
        Array.isArray(existingId.in)
      ) {
        const intersection = existingId.in.filter((id) => branchCustomerIds.includes(id));
        where.id = {
          in: intersection.length > 0 ? intersection : ['00000000-0000-0000-0000-000000000000'],
        };
      } else {
        where.id = {
          in:
            branchCustomerIds.length > 0
              ? branchCustomerIds
              : ['00000000-0000-0000-0000-000000000000'],
        };
      }
    } else if (filters.allowedBranchIds && filters.allowedBranchIds.length > 0) {
      const branchCustomerIds = await this.findCustomerIdsForBranches(
        orgId,
        filters.allowedBranchIds,
      );
      const existingId = where.id;
      if (
        existingId &&
        typeof existingId === 'object' &&
        'in' in existingId &&
        Array.isArray(existingId.in)
      ) {
        const intersection = existingId.in.filter((id) => branchCustomerIds.includes(id));
        where.id = {
          in: intersection.length > 0 ? intersection : ['00000000-0000-0000-0000-000000000000'],
        };
      } else {
        where.id = {
          in:
            branchCustomerIds.length > 0
              ? branchCustomerIds
              : ['00000000-0000-0000-0000-000000000000'],
        };
      }
    }

    return this.withOrg(orgId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.customer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            loyaltyAccount: { select: { referralCode: true } },
          },
        }),
        tx.customer.count({ where }),
      ]);

      const enriched = await this.enrichListRows(tx, orgId, rows);
      return {
        data: enriched,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  async getByIdForPrincipal(orgId: string, userId: string, customerId: string) {
    await this.requireCrm(orgId);
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    const profile = await this.getById(orgId, customerId);
    if (allowed !== null) {
      const branchIds = await this.customerBranchIds(orgId, profile);
      const visible = branchIds.some((id) => allowed.includes(id));
      if (!visible && branchIds.length > 0) {
        throw new ForbiddenException('Customer not in your branch scope');
      }
      if (branchIds.length === 0 && allowed.length === 0) {
        throw new ForbiddenException('Customer not in your branch scope');
      }
    }
    return profile;
  }

  async getById(orgId: string, customerId: string) {
    await this.requireCrm(orgId);
    return this.withOrg(orgId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, orgId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const contact: CustomerContact = customer;
      const { tags, notes } = parseCustomerMetadata(customer.metadata);
      const [timeline, consentLedger] = await Promise.all([
        this.buildTimeline(tx, orgId, contact),
        tx.consentLedgerEntry.findMany({
          where: { orgId, customerId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ]);

      const stats = await this.computeVisitStats(tx, orgId, contact);

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        tags,
        notes,
        transactionalSmsAllowed: customer.transactionalSmsAllowed,
        marketingSmsConsent: customer.marketingSmsConsent,
        marketingEmailConsent: customer.marketingEmailConsent,
        visitCount: stats.visitCount,
        lastVisitAt: stats.lastVisitAt,
        createdAt: customer.createdAt,
        timeline,
        consentLedger,
      };
    });
  }

  async create(
    orgId: string,
    data: {
      name: string;
      email?: string;
      phone?: string;
      marketingSmsConsent?: boolean;
      marketingEmailConsent?: boolean;
    },
  ) {
    await this.requireCrm(orgId);

    const email = data.email?.trim() || null;
    const phone = data.phone?.trim() || null;

    if (email || phone) {
      const duplicate = await this.withOrg(orgId, (tx) =>
        tx.customer.findFirst({
          where: {
            orgId,
            OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
          },
          select: { id: true },
        }),
      );
      if (duplicate) {
        throw new ConflictException('A patron with this email or phone already exists');
      }
    }

    const marketingSms = data.marketingSmsConsent ? 'OPTED_IN' : 'REVOKED';
    const marketingEmail = data.marketingEmailConsent ? 'OPTED_IN' : 'REVOKED';

    const created = await this.withOrg(orgId, (tx) =>
      tx.customer.create({
        data: {
          orgId,
          name: data.name.trim(),
          email,
          phone,
          marketingSmsConsent: marketingSms,
          marketingEmailConsent: marketingEmail,
          marketingConsentSource: 'staff_crm',
        },
      }),
    );

    this.eventEmitter.emit(
      LOYALTY_EVENTS.CUSTOMER_CREATED,
      new LoyaltyCustomerCreatedEvent(orgId, created.id),
    );

    const { tags, notes } = parseCustomerMetadata(created.metadata);
    return {
      id: created.id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      tags,
      notes,
      marketingSmsConsent: created.marketingSmsConsent,
      marketingEmailConsent: created.marketingEmailConsent,
      createdAt: created.createdAt,
    };
  }

  async update(
    orgId: string,
    customerId: string,
    data: { name?: string; tags?: string[]; notes?: string },
  ) {
    await this.requireCrm(orgId);
    return this.withOrg(orgId, async (tx) => {
      const existing = await tx.customer.findFirst({ where: { id: customerId, orgId } });
      if (!existing) {
        throw new NotFoundException('Customer not found');
      }
      const metadata = mergeCustomerMetadata(existing.metadata, {
        tags: data.tags,
        notes: data.notes,
      });
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      const { tags, notes } = parseCustomerMetadata(updated.metadata);
      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        tags,
        notes,
      };
    });
  }

  listPresetSegments() {
    return CUSTOMER_SEGMENT_PRESET_VALUES.map((id) => ({
      id,
      name: CUSTOMER_SEGMENT_PRESET_LABELS[id],
      preset: true,
    }));
  }

  async listSavedSegments(orgId: string) {
    await this.requireCrm(orgId);
    return this.withOrg(orgId, (tx) =>
      tx.customerSegment.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async createSavedSegment(orgId: string, data: { name: string; filters: CustomerSegmentFilters }) {
    await this.requireCrm(orgId);
    return this.withOrg(orgId, (tx) =>
      tx.customerSegment.create({
        data: {
          orgId,
          name: data.name,
          filters: data.filters as Prisma.InputJsonValue,
        },
      }),
    );
  }

  async deleteSavedSegment(orgId: string, segmentId: string) {
    await this.requireCrm(orgId);
    return this.withOrg(orgId, async (tx) => {
      const existing = await tx.customerSegment.findFirst({
        where: { id: segmentId, orgId },
      });
      if (!existing) {
        throw new NotFoundException('Segment not found');
      }
      await tx.customerSegment.delete({ where: { id: segmentId } });
    });
  }

  private async resolveSegmentFilters(
    orgId: string,
    filters: CustomerListFilters,
  ): Promise<CustomerSegmentFilters> {
    if (filters.savedSegmentId) {
      const saved = await this.withOrg(orgId, (tx) =>
        tx.customerSegment.findFirst({ where: { id: filters.savedSegmentId, orgId } }),
      );
      if (!saved) {
        throw new NotFoundException('Saved segment not found');
      }
      const raw = saved.filters;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as CustomerSegmentFilters;
      }
    }
    return {
      preset: filters.segment,
      branchId: filters.branchId,
      search: filters.search,
    };
  }

  private async findCustomerIdsForBranch(orgId: string, branchId: string): Promise<string[]> {
    return this.findCustomerIdsForBranches(orgId, [branchId]);
  }

  private async findCustomerIdsForBranches(orgId: string, branchIds: string[]): Promise<string[]> {
    return this.withOrg(orgId, async (tx) => {
      const [ticketRows, appointmentRows, customers] = await Promise.all([
        tx.ticket.findMany({
          where: { orgId, branchId: { in: branchIds }, customerId: { not: null } },
          select: { customerId: true, customerPhone: true, customerEmail: true },
        }),
        tx.appointment.findMany({
          where: { orgId, branchId: { in: branchIds } },
          select: { customerPhone: true, customerEmail: true },
        }),
        tx.customer.findMany({
          where: { orgId },
          select: { id: true, phone: true, email: true },
        }),
      ]);

      const ids = new Set<string>();
      for (const row of ticketRows) {
        if (row.customerId) ids.add(row.customerId);
      }

      const phoneSet = new Set<string>();
      const emailSet = new Set<string>();
      for (const row of [...ticketRows, ...appointmentRows]) {
        if (row.customerPhone) phoneSet.add(row.customerPhone);
        if (row.customerEmail) emailSet.add(row.customerEmail.toLowerCase());
      }

      for (const c of customers) {
        if (ids.has(c.id)) continue;
        if (c.phone && phoneSet.has(c.phone)) ids.add(c.id);
        if (c.email && emailSet.has(c.email.toLowerCase())) ids.add(c.id);
      }

      return [...ids];
    });
  }

  private async enrichListRows(
    tx: PrismaClient,
    orgId: string,
    rows: Array<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      metadata: Prisma.JsonValue;
      marketingSmsConsent: string;
      marketingEmailConsent: string;
      createdAt: Date;
      loyaltyAccount?: { referralCode: string } | null;
    }>,
  ) {
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const { tags, notes } = parseCustomerMetadata(row.metadata);
        const stats = await this.computeVisitStats(tx, orgId, row);
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          tags,
          notes,
          marketingSmsConsent: row.marketingSmsConsent,
          marketingEmailConsent: row.marketingEmailConsent,
          visitCount: stats.visitCount,
          lastVisitAt: stats.lastVisitAt,
          createdAt: row.createdAt,
          referralCode: row.loyaltyAccount?.referralCode || null,
        };
      }),
    );
    return enriched;
  }

  private async computeVisitStats(
    tx: PrismaClient,
    orgId: string,
    contact: CustomerContact,
  ): Promise<{ visitCount: number; lastVisitAt: string | null }> {
    const ticketWhere: Prisma.TicketWhereInput = {
      orgId,
      OR: ticketContactOr(contact),
    };
    const visitWhere: Prisma.VisitWhereInput = {
      orgId,
      OR: visitContactOr(contact),
    };
    const appointmentWhere: Prisma.AppointmentWhereInput = {
      orgId,
      OR: appointmentContactOr(contact),
    };

    const [ticketCount, visitCount, ticketMax, visitMax, appointmentMax] = await Promise.all([
      tx.ticket.count({ where: ticketWhere }),
      tx.visit.count({ where: visitWhere }),
      tx.ticket.aggregate({
        where: ticketWhere,
        _max: { completedAt: true, bookedAt: true },
      }),
      tx.visit.aggregate({
        where: visitWhere,
        _max: { startedAt: true },
      }),
      tx.appointment.aggregate({
        where: appointmentWhere,
        _max: { scheduledAt: true },
      }),
    ]);

    const dates = [
      ticketMax._max.completedAt,
      ticketMax._max.bookedAt,
      visitMax._max.startedAt,
      appointmentMax._max.scheduledAt,
    ].filter((d): d is Date => d instanceof Date);

    const lastVisitAt =
      dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : null;

    return {
      visitCount: ticketCount + visitCount,
      lastVisitAt,
    };
  }

  private async customerBranchIds(orgId: string, contact: CustomerContact): Promise<string[]> {
    return this.withOrg(orgId, async (tx) => {
      const [ticketBranches, appointmentBranches, visitBranches] = await Promise.all([
        tx.ticket.findMany({
          where: { orgId, OR: ticketContactOr(contact) },
          distinct: ['branchId'],
          select: { branchId: true },
        }),
        tx.appointment.findMany({
          where: { orgId, OR: appointmentContactOr(contact) },
          distinct: ['branchId'],
          select: { branchId: true },
        }),
        tx.visit.findMany({
          where: { orgId, OR: visitContactOr(contact) },
          distinct: ['branchId'],
          select: { branchId: true },
        }),
      ]);
      const ids = new Set<string>();
      for (const row of [...ticketBranches, ...appointmentBranches, ...visitBranches]) {
        ids.add(row.branchId);
      }
      return [...ids];
    });
  }

  private async buildTimeline(tx: PrismaClient, orgId: string, contact: CustomerContact) {
    const notificationOr: Prisma.NotificationWhereInput[] = [];
    if (contact.phone) {
      notificationOr.push({
        payload: { path: ['to'], equals: contact.phone },
      });
    }
    if (contact.email) {
      notificationOr.push({
        payload: { path: ['to'], equals: contact.email },
      });
    }

    const [tickets, appointments, visits, reviews, notifications] = await Promise.all([
      tx.ticket.findMany({
        where: { orgId, OR: ticketContactOr(contact) },
        include: {
          branch: { select: { id: true, name: true } },
          queue: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: { bookedAt: 'desc' },
        take: 50,
      }),
      tx.appointment.findMany({
        where: { orgId, OR: appointmentContactOr(contact) },
        include: {
          branch: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
      }),
      tx.visit.findMany({
        where: { orgId, OR: visitContactOr(contact) },
        include: { branch: { select: { id: true, name: true } } },
        orderBy: { startedAt: 'desc' },
        take: 50,
      }),
      tx.review.findMany({
        where: { orgId, OR: reviewContactOr(contact) },
        include: { branch: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      notificationOr.length > 0
        ? tx.notification.findMany({
            where: { orgId, recipientType: 'customer', OR: notificationOr },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    type TimelineItem = {
      id: string;
      type: 'ticket' | 'appointment' | 'visit' | 'review' | 'notification';
      occurredAt: string;
      title: string;
      subtitle?: string;
      status?: string;
      meta?: Record<string, unknown>;
    };

    const items: TimelineItem[] = [];

    for (const t of tickets) {
      items.push({
        id: t.id,
        type: 'ticket',
        occurredAt: (t.completedAt ?? t.bookedAt).toISOString(),
        title: `Ticket ${t.displayNumber}`,
        subtitle: [t.branch?.name, t.service?.name].filter(Boolean).join(' · ') || undefined,
        status: t.status,
        meta: { queueName: t.queue?.name },
      });
    }
    for (const a of appointments) {
      items.push({
        id: a.id,
        type: 'appointment',
        occurredAt: a.scheduledAt.toISOString(),
        title: 'Appointment',
        subtitle: [a.branch?.name, a.service?.name].filter(Boolean).join(' · ') || undefined,
        status: a.status,
      });
    }
    for (const v of visits) {
      items.push({
        id: v.id,
        type: 'visit',
        occurredAt: v.startedAt.toISOString(),
        title: 'Visit',
        subtitle: v.branch?.name,
        status: v.status,
      });
    }
    for (const r of reviews) {
      items.push({
        id: r.id,
        type: 'review',
        occurredAt: r.createdAt.toISOString(),
        title: `Review (${r.rating}★)`,
        subtitle: r.branch?.name ?? undefined,
        status: r.status,
        meta: { rating: r.rating, comment: r.comment },
      });
    }
    for (const n of notifications) {
      const payload = n.payload as Record<string, unknown>;
      items.push({
        id: n.id,
        type: 'notification',
        occurredAt: (n.sentAt ?? n.createdAt).toISOString(),
        title: `${n.channel.toUpperCase()} notification`,
        subtitle: typeof payload.body === 'string' ? payload.body.slice(0, 120) : undefined,
        status: n.status,
      });
    }

    items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return items.slice(0, 100);
  }
}
