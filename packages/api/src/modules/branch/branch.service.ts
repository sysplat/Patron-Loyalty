import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { generateSlug, normalizeTimeZone } from '@queueplatform/shared';
import { PlanLimitService } from '../billing/plan-limit.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';

interface WorkingHourInput {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  breakStart?: string;
  breakEnd?: string;
}

interface DateOverrideInput {
  date: string;
  openTime?: string;
  closeTime?: string;
  isClosed: boolean;
  breakStart?: string;
  breakEnd?: string;
  note?: string;
}

/**
 * Manages branches (physical locations) for an organization.
 * Handles branch creation, configuration, and operating hours.
 */
@Injectable()
export class BranchService {
  private readonly logger = new Logger(BranchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  private normalizeJourneyMode(mode?: string | null): 'single_ticket' | 'visit_multi_step' {
    if (!mode || mode === 'single_ticket') return 'single_ticket';
    if (mode === 'visit_multi_step') return 'visit_multi_step';
    throw new ConflictException(
      'Invalid journey mode. Supported values: single_ticket, visit_multi_step',
    );
  }

  async list(orgId: string, allowedBranchIds?: string[] | null) {
    // Empty array = principal has no org-wide privilege and no branch assignments — must not list entire org.
    if (Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0) {
      return [];
    }
    const where: { orgId: string; id?: { in: string[] } } = { orgId };
    if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.id = { in: allowedBranchIds };
    }
    return this.withOrg(orgId, (tx) =>
      tx.branch.findMany({
        where,
        include: { _count: { select: { branchServices: true, queues: true, desks: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  /** Lists branches visible to the given org member (RBAC already enforced on the route). */
  async listForPrincipal(orgId: string, userId: string) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    return this.list(orgId, allowed);
  }

  /**
   * Returns minimal public-safe branch info (name, address, phone, timezone).
   * Does NOT require org context — used by the public booking page.
   */
  async getPublicById(branchId: string): Promise<{
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    timezone: string;
    smsComplianceComplete: boolean;
    crmEnabled: boolean;
    organization: { name: string; logoUrl: string | null };
  }> {
    return this.prisma.withBypassRls(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: branchId },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          timezone: true,
          organization: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              website: true,
              country: true,
              industry: true,
            },
          },
        },
      });
      if (!branch) throw new NotFoundException('Branch not found');

      const org = branch.organization;
      const smsComplianceComplete = Boolean(
        org?.website?.trim() && org?.country?.trim() && org?.industry?.trim(),
      );

      const crmEnabled = await this.patronCrmFeature.isEnabled(org.id);

      return {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        timezone: normalizeTimeZone(branch.timezone),
        smsComplianceComplete,
        crmEnabled,
        organization: {
          name: org?.name ?? 'Organization',
          logoUrl: org?.logoUrl ?? null,
        },
      };
    });
  }

  async getById(orgId: string, branchId: string) {
    const branch = await this.withOrg(orgId, (tx) =>
      tx.branch.findFirst({
        where: { id: branchId, orgId },
        include: {
          workingHours: { orderBy: { dayOfWeek: 'asc' } },
          branchServices: { include: { service: true } },
          desks: true,
        },
      }),
    );
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(
    orgId: string,
    data: {
      name: string;
      address?: string;
      lat?: number;
      lng?: number;
      timezone: string;
      phone?: string;
      email?: string;
      defaultJourneyMode?: string;
      initialDesksCount?: number;
    },
  ) {
    const slug = generateSlug(data.name);
    const existing = await this.withOrg(orgId, (tx) =>
      tx.branch.findFirst({
        where: { orgId, slug },
      }),
    );
    if (existing) throw new ConflictException('A branch with this name already exists');

    const currentCount = await this.withOrg(orgId, (tx) => tx.branch.count({ where: { orgId } }));
    const limitCheck = await this.planLimits.checkLimit(orgId, 'maxBranches', currentCount);
    if (limitCheck.limitReached) {
      throw new ForbiddenException(
        `Branch limit reached. Your plan allows ${limitCheck.limit} branches. Please upgrade to add more.`,
      );
    }

    return this.withOrg(orgId, async (tx) => {
      const branch = await tx.branch.create({
        data: {
          orgId,
          slug,
          name: data.name,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          timezone: normalizeTimeZone(data.timezone),
          phone: data.phone,
          email: data.email,
          defaultJourneyMode: this.normalizeJourneyMode(data.defaultJourneyMode),
        },
      });

      const defaultHours = Array.from({ length: 7 }, (_, i) => ({
        branchId: branch.id,
        dayOfWeek: i,
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: i >= 5,
      }));

      await tx.workingHours.createMany({ data: defaultHours });

      if (data.initialDesksCount && data.initialDesksCount > 0) {
        const count = Math.min(Math.max(1, data.initialDesksCount), 20);
        const initialDesks = Array.from({ length: count }, (_, i) => ({
          orgId,
          branchId: branch.id,
          name: `Desk ${i + 1}`,
          number: String(i + 1),
          status: 'closed',
        }));
        await tx.desk.createMany({ data: initialDesks });
      }

      return branch;
    });
  }

  async updateCustomerNotice(
    orgId: string,
    branchId: string,
    data: {
      branchId?: string;
      exceptionalCustomerNotice?: boolean;
      exceptionalCustomerNoticeMinutes?: number | null;
    },
  ) {
    await this.getById(orgId, branchId);
    const { exceptionalCustomerNotice, exceptionalCustomerNoticeMinutes } = data;
    return this.withOrg(orgId, (tx) =>
      tx.branch.update({
        where: { id: branchId },
        data: {
          ...(exceptionalCustomerNotice !== undefined ? { exceptionalCustomerNotice } : {}),
          ...(exceptionalCustomerNoticeMinutes !== undefined
            ? { exceptionalCustomerNoticeMinutes }
            : {}),
        },
      }),
    );
  }

  async update(
    orgId: string,
    branchId: string,
    data: Partial<{
      name: string;
      address: string;
      lat: number;
      lng: number;
      timezone: string;
      phone: string;
      email: string;
      status: string;
      exceptionalCustomerNotice: boolean;
      exceptionalCustomerNoticeMinutes: number | null;
      defaultJourneyMode: string;
    }>,
  ) {
    await this.getById(orgId, branchId); // Verify exists
    const normalizedData =
      data.timezone === undefined
        ? data
        : {
            ...data,
            timezone: normalizeTimeZone(data.timezone),
          };
    const normalizedJourneyMode =
      normalizedData.defaultJourneyMode === undefined
        ? {}
        : { defaultJourneyMode: this.normalizeJourneyMode(normalizedData.defaultJourneyMode) };

    return this.withOrg(orgId, (tx) =>
      tx.branch.update({
        where: { id: branchId },
        data: {
          ...normalizedData,
          ...normalizedJourneyMode,
        },
      }),
    );
  }

  async delete(orgId: string, branchId: string) {
    await this.getById(orgId, branchId);
    return this.withOrg(orgId, (tx) => tx.branch.delete({ where: { id: branchId } }));
  }

  async getWorkingHours(orgId: string, branchId: string) {
    await this.getById(orgId, branchId);
    return this.withOrg(orgId, (tx) =>
      tx.workingHours.findMany({
        where: { branchId },
        orderBy: { dayOfWeek: 'asc' },
      }),
    );
  }

  /**
   * Lists exact-date schedule overrides for a branch.
   */
  async getDateOverrides(orgId: string, branchId: string) {
    await this.getById(orgId, branchId);
    return this.withOrg(orgId, (tx) =>
      tx.branchDateOverride.findMany({
        where: { branchId },
        orderBy: { date: 'asc' },
      }),
    );
  }

  /**
   * Persists recurring weekly working hours for a branch.
   */
  async setWorkingHours(orgId: string, branchId: string, hours: WorkingHourInput[]) {
    await this.getById(orgId, branchId);

    await this.withOrg(orgId, async (tx) => {
      for (const h of hours) {
        await tx.workingHours.upsert({
          where: { branchId_dayOfWeek: { branchId, dayOfWeek: h.dayOfWeek } },
          update: {
            openTime: h.openTime,
            closeTime: h.closeTime,
            isClosed: h.isClosed,
            breakStart: h.breakStart ?? null,
            breakEnd: h.breakEnd ?? null,
          },
          create: {
            branchId,
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime,
            closeTime: h.closeTime,
            isClosed: h.isClosed,
            breakStart: h.breakStart ?? null,
            breakEnd: h.breakEnd ?? null,
          },
        });
      }
    });

    return this.getWorkingHours(orgId, branchId);
  }

  /**
   * Creates or updates the schedule for a specific calendar date.
   */
  async upsertDateOverride(orgId: string, branchId: string, data: DateOverrideInput) {
    await this.getById(orgId, branchId);

    const normalizedDate = new Date(`${data.date}T00:00:00.000Z`);

    return this.withOrg(orgId, (tx) =>
      tx.branchDateOverride.upsert({
        where: { branchId_date: { branchId, date: normalizedDate } },
        update: {
          isClosed: data.isClosed,
          openTime: data.isClosed ? null : (data.openTime ?? null),
          closeTime: data.isClosed ? null : (data.closeTime ?? null),
          breakStart: data.isClosed ? null : (data.breakStart ?? null),
          breakEnd: data.isClosed ? null : (data.breakEnd ?? null),
          note: data.note ?? null,
        },
        create: {
          branchId,
          date: normalizedDate,
          isClosed: data.isClosed,
          openTime: data.isClosed ? null : (data.openTime ?? null),
          closeTime: data.isClosed ? null : (data.closeTime ?? null),
          breakStart: data.isClosed ? null : (data.breakStart ?? null),
          breakEnd: data.isClosed ? null : (data.breakEnd ?? null),
          note: data.note ?? null,
        },
      }),
    );
  }

  /**
   * Deletes a date-specific schedule override from a branch.
   */
  async deleteDateOverride(orgId: string, branchId: string, overrideId: string): Promise<void> {
    await this.getById(orgId, branchId);

    await this.withOrg(orgId, async (tx) => {
      const existing = await tx.branchDateOverride.findFirst({
        where: { id: overrideId, branchId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Date override not found');
      }

      await tx.branchDateOverride.delete({ where: { id: overrideId } });
    });
  }
}
