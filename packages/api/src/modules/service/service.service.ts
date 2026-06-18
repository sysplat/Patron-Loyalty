import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { generateSlug } from '@queueplatform/shared';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';

interface ServiceMutationData {
  name: string;
  description?: string;
  durationMinutes?: number;
  categoryId?: string;
  branchIds?: string[];
  queueEnabled?: boolean;
  appointmentEnabled?: boolean;
  appointmentSlotInterval?: number;
  appointmentLeadTimeMinutes?: number;
  appointmentMaxAdvanceDays?: number;
  appointmentBufferMinutes?: number;
  appointmentRequiresEmail?: boolean;
  /** Minimum minutes per customer turn (queue). Required with serviceEstimateHighMinutes when queueEnabled. */
  serviceEstimateLowMinutes?: number;
  /** Maximum minutes per customer turn (queue). Must be ≥ low. */
  serviceEstimateHighMinutes?: number;
  /** Optional org-wide service journey mode override. */
  journeyModeOverride?: string | null;
  /** Optional tip shown on the customer track page (e.g. "Keep your passport ready"). */
  instructionalTip?: string | null;
}

interface ServiceUpdateData {
  name?: string;
  description?: string;
  durationMinutes?: number;
  categoryId?: string;
  branchIds?: string[];
  status?: string;
  sortOrder?: number;
  queueEnabled?: boolean;
  appointmentEnabled?: boolean;
  appointmentSlotInterval?: number;
  appointmentLeadTimeMinutes?: number;
  appointmentMaxAdvanceDays?: number;
  appointmentBufferMinutes?: number;
  appointmentRequiresEmail?: boolean;
  serviceEstimateLowMinutes?: number;
  serviceEstimateHighMinutes?: number;
  journeyModeOverride?: string | null;
  instructionalTip?: string | null;
}

/**
 * Manages the service catalog for an organization's branches.
 * Handles service creation, configuration, and association with queues.
 */
@Injectable()
export class ServiceService {
  private readonly logger = new Logger(ServiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalizeInstructionalTip(tip: string | null | undefined): string | null | undefined {
    if (tip === undefined) return undefined;
    const trimmed = (tip ?? '').trim();
    if (!trimmed) return null;
    if (trimmed.length > 500) {
      throw new BadRequestException('Customer tip must be 500 characters or fewer.');
    }
    return trimmed;
  }

  private normalizeJourneyModeOverride(
    mode: string | null | undefined,
  ): 'single_ticket' | 'visit_multi_step' | null | undefined {
    if (mode === undefined) return undefined;
    if (mode === null || mode === '') return null;
    if (mode === 'single_ticket' || mode === 'visit_multi_step') return mode;
    throw new BadRequestException(
      'Invalid journey mode. Supported values: single_ticket, visit_multi_step',
    );
  }

  private async validateBranchIds(orgId: string, branchIds: string[]): Promise<void> {
    if (branchIds.length === 0) {
      return;
    }

    const matchingBranches = await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.count({
        where: {
          orgId,
          id: { in: branchIds },
        },
      }),
    );

    if (matchingBranches !== branchIds.length) {
      throw new BadRequestException('One or more selected branches are invalid');
    }
  }

  private validateQueueServiceEstimates(
    queueEnabled: boolean,
    low: number | null | undefined,
    high: number | null | undefined,
  ): void {
    if (!queueEnabled) return;
    if (
      low === null ||
      low === undefined ||
      high === null ||
      high === undefined ||
      !Number.isFinite(low) ||
      !Number.isFinite(high)
    ) {
      throw new BadRequestException(
        'Queue-enabled services require both serviceEstimateLowMinutes and serviceEstimateHighMinutes (minutes per customer).',
      );
    }
    if (low < 1 || high < 1 || low > high) {
      throw new BadRequestException(
        'Service time estimates must be at least 1 minute, with lowest less than or equal to highest.',
      );
    }
  }

  private validateAppointmentOnlyDuration(
    appointmentEnabled: boolean,
    queueEnabled: boolean,
    durationMinutes: number | null | undefined,
  ): void {
    if (!appointmentEnabled || queueEnabled) return;
    if (
      durationMinutes === null ||
      durationMinutes === undefined ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 1
    ) {
      throw new BadRequestException(
        'Appointment-only services require durationMinutes of at least 1.',
      );
    }
  }

  /** Stored duration for legacy / appointments; midpoint of queue low–high when queue is enabled. */
  private resolveStoredDurationMinutes(
    queueEnabled: boolean,
    low: number | null | undefined,
    high: number | null | undefined,
    explicitDuration: number | null | undefined,
  ): number {
    if (
      queueEnabled &&
      low != null &&
      high != null &&
      Number.isFinite(low) &&
      Number.isFinite(high)
    ) {
      return Math.round((low + high) / 2);
    }
    if (explicitDuration != null && Number.isFinite(explicitDuration) && explicitDuration >= 1) {
      return Math.round(explicitDuration);
    }
    return 15;
  }

  private validateBranchQueueEstimateOverrides(
    low: number | null | undefined,
    high: number | null | undefined,
  ): void {
    const lo = low === undefined ? null : low;
    const hi = high === undefined ? null : high;
    if (lo === null && hi === null) return;
    if (lo === null || hi === null) {
      throw new BadRequestException(
        'Set both branch serviceEstimateLowMinutes and serviceEstimateHighMinutes, or leave both null for service defaults.',
      );
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 1 || hi < 1 || lo > hi) {
      throw new BadRequestException(
        'Branch service time overrides must be at least 1 minute, with lowest ≤ highest.',
      );
    }
  }

  /**
   * Per-branch queue overrides: optional low/high minutes per customer.
   */
  async patchBranchQueueSettings(
    orgId: string,
    userId: string,
    serviceId: string,
    branchId: string,
    body: {
      serviceEstimateLowMinutes?: number | null;
      serviceEstimateHighMinutes?: number | null;
      journeyModeOverride?: string | null;
    },
  ) {
    await this.getById(orgId, serviceId);
    await this.validateBranchIds(orgId, [branchId]);

    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (allowed !== null && (allowed.length === 0 || !allowed.includes(branchId))) {
      throw new ForbiddenException('Branch not in your scope');
    }

    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.branchService.findUnique({
        where: { branchId_serviceId: { branchId, serviceId } },
        select: {
          customServiceEstimateLowMinutes: true,
          customServiceEstimateHighMinutes: true,
        },
      }),
    );

    const nextLow =
      body.serviceEstimateLowMinutes !== undefined
        ? body.serviceEstimateLowMinutes
        : (existing?.customServiceEstimateLowMinutes ?? null);
    const nextHigh =
      body.serviceEstimateHighMinutes !== undefined
        ? body.serviceEstimateHighMinutes
        : (existing?.customServiceEstimateHighMinutes ?? null);
    const nextJourneyModeOverride =
      body.journeyModeOverride !== undefined
        ? this.normalizeJourneyModeOverride(body.journeyModeOverride)
        : undefined;

    this.validateBranchQueueEstimateOverrides(nextLow, nextHigh);

    await this.prisma.withTenant(orgId, (tx) =>
      tx.branchService.upsert({
        where: {
          branchId_serviceId: { branchId, serviceId },
        },
        create: {
          branchId,
          serviceId,
          isActive: true,
          capacity: null,
          customServiceEstimateLowMinutes: nextLow,
          customServiceEstimateHighMinutes: nextHigh,
          journeyModeOverride: nextJourneyModeOverride ?? null,
        },
        update: {
          customServiceEstimateLowMinutes: nextLow,
          customServiceEstimateHighMinutes: nextHigh,
          ...(nextJourneyModeOverride !== undefined
            ? { journeyModeOverride: nextJourneyModeOverride }
            : {}),
        },
      }),
    );

    return this.getById(orgId, serviceId);
  }

  async list(
    orgId: string,
    allowedBranchIds?: string[] | null,
    search?: string,
    branchId?: string,
  ) {
    if (Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0) {
      return [];
    }
    let effectiveBranchIds = allowedBranchIds;
    if (branchId) {
      if (allowedBranchIds && !allowedBranchIds.includes(branchId)) {
        return [];
      }
      effectiveBranchIds = [branchId];
    }
    const where: Prisma.ServiceWhereInput = { orgId };
    if (effectiveBranchIds && effectiveBranchIds.length > 0) {
      where.branchServices = { some: { branchId: { in: effectiveBranchIds } } };
    }
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    return this.prisma.withTenant(orgId, (tx) =>
      tx.service.findMany({
        where,
        include: {
          category: true,
          branchServices: { include: { branch: { select: { id: true, name: true } } } },
        },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }

  async listForPrincipal(orgId: string, userId: string, search?: string, branchId?: string) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    return this.list(orgId, allowed, search, branchId);
  }

  async analyticsSummaryForPrincipal(orgId: string, userId: string) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    const branchScoped =
      allowed && allowed.length > 0
        ? { branchServices: { some: { branchId: { in: allowed } } } }
        : {};
    const baseWhere: Prisma.ServiceWhereInput = { orgId, ...branchScoped };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, queueEnabled, appointmentEnabled, topServices] = await this.prisma.withTenant(
      orgId,
      async (tx) => {
        return Promise.all([
          tx.service.count({ where: baseWhere }),
          tx.service.count({ where: { ...baseWhere, queueEnabled: true } }),
          tx.service.count({ where: { ...baseWhere, appointmentEnabled: true } }),
          tx.ticket.groupBy({
            by: ['serviceId'],
            where: {
              orgId,
              bookedAt: { gte: thirtyDaysAgo },
              ...(allowed && allowed.length > 0 ? { branchId: { in: allowed } } : {}),
            },
            _count: { serviceId: true },
            orderBy: { _count: { serviceId: 'desc' } },
            take: 5,
          }),
        ]);
      },
    );

    const names = topServices.length
      ? await this.prisma.withTenant(orgId, (tx) =>
          tx.service.findMany({
            where: { id: { in: topServices.map((s) => s.serviceId) }, orgId },
            select: { id: true, name: true },
          }),
        )
      : [];
    const nameMap = new Map(names.map((row) => [row.id, row.name]));

    return {
      total,
      queueEnabled,
      appointmentEnabled,
      topServices: topServices.map((row) => ({
        serviceId: row.serviceId,
        serviceName: nameMap.get(row.serviceId) ?? 'Unknown service',
        ticketsLast30Days: row._count.serviceId ?? 0,
      })),
    };
  }

  async getById(orgId: string, serviceId: string) {
    const service = await this.prisma.withTenant(orgId, (tx) =>
      tx.service.findFirst({
        where: { id: serviceId, orgId },
        include: { category: true, branchServices: { include: { branch: true } } },
      }),
    );
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(orgId: string, data: ServiceMutationData) {
    const slug = generateSlug(data.name);
    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.service.findFirst({ where: { orgId, slug } }),
    );
    if (existing) throw new ConflictException('A service with this name already exists');
    const queueEnabled = data.queueEnabled ?? true;
    const appointmentEnabled = data.appointmentEnabled ?? false;
    const branchIds = [...new Set(data.branchIds ?? [])];

    if (!queueEnabled && !appointmentEnabled) {
      throw new BadRequestException('Service must be enabled for queueing or appointments');
    }

    this.validateQueueServiceEstimates(
      queueEnabled,
      data.serviceEstimateLowMinutes,
      data.serviceEstimateHighMinutes,
    );
    this.validateAppointmentOnlyDuration(appointmentEnabled, queueEnabled, data.durationMinutes);

    const storedDuration = this.resolveStoredDurationMinutes(
      queueEnabled,
      data.serviceEstimateLowMinutes,
      data.serviceEstimateHighMinutes,
      data.durationMinutes,
    );

    await this.validateBranchIds(orgId, branchIds);

    return this.prisma.withTenant(orgId, async (tx) => {
      const service = await tx.service.create({
        data: {
          orgId,
          name: data.name,
          slug,
          description: data.description,
          durationMinutes: storedDuration,
          categoryId: data.categoryId,
          queueEnabled,
          appointmentEnabled,
          appointmentSlotInterval: data.appointmentSlotInterval,
          appointmentLeadTimeMinutes: data.appointmentLeadTimeMinutes ?? 60,
          appointmentMaxAdvanceDays: data.appointmentMaxAdvanceDays ?? 30,
          appointmentBufferMinutes: data.appointmentBufferMinutes ?? 0,
          appointmentRequiresEmail: data.appointmentRequiresEmail ?? false,
          serviceEstimateLowMinutes: data.serviceEstimateLowMinutes ?? 5,
          serviceEstimateHighMinutes: data.serviceEstimateHighMinutes ?? 15,
          journeyModeOverride: this.normalizeJourneyModeOverride(data.journeyModeOverride) ?? null,
          instructionalTip: this.normalizeInstructionalTip(data.instructionalTip) ?? null,
        },
      });

      if (branchIds.length > 0) {
        await tx.branchService.createMany({
          data: branchIds.map((branchId) => ({ branchId, serviceId: service.id })),
        });
      }

      return tx.service.findUniqueOrThrow({
        where: { id: service.id },
        include: {
          category: true,
          branchServices: { include: { branch: { select: { id: true, name: true } } } },
        },
      });
    });
  }

  async update(orgId: string, serviceId: string, data: ServiceUpdateData) {
    const existing = await this.getById(orgId, serviceId);
    const queueEnabled = data.queueEnabled ?? existing.queueEnabled;
    const appointmentEnabled = data.appointmentEnabled ?? existing.appointmentEnabled;
    const branchIds = data.branchIds ? [...new Set(data.branchIds)] : undefined;

    if (!queueEnabled && !appointmentEnabled) {
      throw new BadRequestException('Service must be enabled for queueing or appointments');
    }

    if (branchIds) {
      await this.validateBranchIds(orgId, branchIds);
    }

    const durationInput =
      data.durationMinutes !== undefined ? data.durationMinutes : existing.durationMinutes;
    const low =
      data.serviceEstimateLowMinutes !== undefined
        ? data.serviceEstimateLowMinutes
        : existing.serviceEstimateLowMinutes;
    const high =
      data.serviceEstimateHighMinutes !== undefined
        ? data.serviceEstimateHighMinutes
        : existing.serviceEstimateHighMinutes;

    this.validateQueueServiceEstimates(queueEnabled, low, high);
    this.validateAppointmentOnlyDuration(appointmentEnabled, queueEnabled, durationInput);

    const resolvedDuration = this.resolveStoredDurationMinutes(
      queueEnabled,
      low,
      high,
      durationInput,
    );

    return this.prisma.withTenant(orgId, async (tx) => {
      const {
        branchIds: _branchIds,
        instructionalTip: _tip,
        journeyModeOverride: _journey,
        ...serviceData
      } = data;
      const normalizedTip = this.normalizeInstructionalTip(data.instructionalTip);

      await tx.service.update({
        where: { id: serviceId },
        data: {
          ...serviceData,
          serviceEstimateLowMinutes: low,
          serviceEstimateHighMinutes: high,
          durationMinutes: resolvedDuration,
          ...(data.journeyModeOverride !== undefined
            ? { journeyModeOverride: this.normalizeJourneyModeOverride(data.journeyModeOverride) }
            : {}),
          ...(normalizedTip !== undefined ? { instructionalTip: normalizedTip } : {}),
        },
      });

      if (branchIds) {
        await tx.branchService.deleteMany({ where: { serviceId } });

        if (branchIds.length > 0) {
          await tx.branchService.createMany({
            data: branchIds.map((branchId) => ({ branchId, serviceId })),
          });
        }
      }

      return tx.service.findUniqueOrThrow({
        where: { id: serviceId },
        include: {
          category: true,
          branchServices: { include: { branch: { select: { id: true, name: true } } } },
        },
      });
    });
  }

  async delete(orgId: string, serviceId: string) {
    await this.getById(orgId, serviceId);
    return this.prisma.withTenant(orgId, (tx) => tx.service.delete({ where: { id: serviceId } }));
  }

  /**
   * Public — returns active services bookable at a specific branch.
   *
   * Strategy:
   *  1. Resolve the org from the branch (no auth needed).
   *  2. Fetch services explicitly assigned to this branch via BranchService.
   *  3. Honour optional custom low/high minute overrides (midpoint used as appointment duration).
   *
   * This ensures services only appear in branches where they are explicitly assigned.
   */
  async listByBranchPublic(branchId: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      durationMinutes: number | null;
      appointmentRequiresEmail: boolean;
    }>
  > {
    const branch = await this.prisma.withBypassRls((tx) =>
      tx.branch.findUnique({
        where: { id: branchId },
        select: { orgId: true },
      }),
    );
    if (!branch) throw new NotFoundException('Branch not found');

    // Fetch services explicitly assigned to this branch
    const services = await this.prisma.withTenant(branch.orgId, (tx) =>
      tx.service.findMany({
        where: {
          orgId: branch.orgId,
          status: 'active',
          appointmentEnabled: true,
          branchServices: {
            some: { branchId, isActive: true },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          serviceEstimateLowMinutes: true,
          serviceEstimateHighMinutes: true,
          appointmentRequiresEmail: true,
          sortOrder: true,
          branchServices: {
            where: { branchId },
            select: {
              isActive: true,
              customServiceEstimateLowMinutes: true,
              customServiceEstimateHighMinutes: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
    );

    return services.map((s) => {
      const pivot = s.branchServices[0];
      const low = pivot?.customServiceEstimateLowMinutes ?? s.serviceEstimateLowMinutes;
      const high = pivot?.customServiceEstimateHighMinutes ?? s.serviceEstimateHighMinutes;
      let durationMinutes = s.durationMinutes;
      if (
        low !== null &&
        high !== null &&
        Number.isFinite(low) &&
        Number.isFinite(high) &&
        low >= 1 &&
        high >= low
      ) {
        durationMinutes = Math.round((low + high) / 2);
      }
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        durationMinutes,
        appointmentRequiresEmail: s.appointmentRequiresEmail,
      };
    });
  }

  // ─── Sub-Services ────────────────────────────

  /**
   * Lists all active sub-services for a given service, scoped to the org.
   */
  async listSubServices(orgId: string, serviceId: string) {
    await this.getById(orgId, serviceId); // validates org ownership
    return this.prisma.withTenant(orgId, (tx) =>
      tx.subService.findMany({
        where: { serviceId },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }

  /**
   * Public listing of sub-services for booking pages (no auth required, branchId used for org lookup).
   */
  async listSubServicesPublic(
    serviceId: string,
  ): Promise<
    { id: string; name: string; description: string | null; durationMinutes: number | null }[]
  > {
    const subServices = await this.prisma.withBypassRls((tx) =>
      tx.subService.findMany({
        where: { serviceId, status: 'active' },
        select: { id: true, name: true, description: true, durationMinutes: true },
        orderBy: { sortOrder: 'asc' },
      }),
    );
    return subServices;
  }

  /**
   * Creates a new sub-service under a service, validating org ownership.
   */
  async createSubService(
    orgId: string,
    serviceId: string,
    data: { name: string; description?: string; durationMinutes?: number; sortOrder?: number },
  ): Promise<{ id: string; serviceId: string; name: string }> {
    await this.getById(orgId, serviceId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.subService.create({
        data: {
          serviceId,
          name: data.name,
          description: data.description,
          durationMinutes: data.durationMinutes,
          sortOrder: data.sortOrder ?? 0,
        },
      }),
    );
  }

  /**
   * Updates a sub-service, validating org ownership via parent service.
   */
  async updateSubService(
    orgId: string,
    serviceId: string,
    subServiceId: string,
    data: Partial<{
      name: string;
      description: string;
      durationMinutes: number;
      sortOrder: number;
      status: string;
    }>,
  ): Promise<{ id: string; serviceId: string; name: string }> {
    await this.getById(orgId, serviceId);
    return this.prisma.withTenant(orgId, async (tx) => {
      const sub = await tx.subService.findFirst({ where: { id: subServiceId, serviceId } });
      if (!sub) throw new NotFoundException('Sub-service not found');
      return tx.subService.update({ where: { id: subServiceId }, data });
    });
  }

  /**
   * Deletes a sub-service, validating org ownership via parent service.
   */
  async deleteSubService(orgId: string, serviceId: string, subServiceId: string): Promise<void> {
    await this.getById(orgId, serviceId);
    await this.prisma.withTenant(orgId, async (tx) => {
      const sub = await tx.subService.findFirst({ where: { id: subServiceId, serviceId } });
      if (!sub) throw new NotFoundException('Sub-service not found');
      await tx.subService.delete({ where: { id: subServiceId } });
    });
  }

  // ─── Categories ──────────────────────────────

  async listCategories(orgId: string) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.serviceCategory.findMany({
        where: { orgId },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }

  async createCategory(orgId: string, data: { name: string; icon?: string; sortOrder?: number }) {
    const slug = generateSlug(data.name);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.serviceCategory.create({
        data: { orgId, name: data.name, slug, icon: data.icon, sortOrder: data.sortOrder ?? 0 },
      }),
    );
  }
}
