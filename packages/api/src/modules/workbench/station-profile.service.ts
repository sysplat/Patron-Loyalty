import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import {
  capabilitiesForJourneyFlowStep,
  COMBINED_JOURNEY_STATION_PROFILE_NAME,
  DEFAULT_COMBINED_CAPABILITIES,
  DEFAULT_PICKUP_CAPABILITIES,
  DEFAULT_SERVICE_CAPABILITIES,
  LEGACY_COMBINED_JOURNEY_STATION_PROFILE_NAME,
  type StationCapability,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';

export type StationProfileQueueInput = {
  queueId: string;
  sortOrder?: number;
  visibilityOnly?: boolean;
  capabilities?: StationCapability[];
};

export type CreateStationProfileInput = {
  branchId: string;
  name: string;
  primaryQueueId?: string | null;
  flowTemplateId?: string | null;
  isDefault?: boolean;
  queues: StationProfileQueueInput[];
};

/** Journey profile repair can run several queue updates; allow slow shared dev DBs. */
const JOURNEY_PROFILE_TX_OPTIONS = { timeoutMs: 30_000, maxWaitMs: 15_000 };

@Injectable()
export class StationProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private withOrg<T>(
    orgId: string,
    fn: (tx: PrismaClient) => Promise<T>,
    options?: { timeoutMs?: number; maxWaitMs?: number },
  ): Promise<T> {
    return this.prisma.withTenant(orgId, fn, options);
  }

  private async assertBranchInScope(
    orgId: string,
    userId: string,
    branchId: string,
  ): Promise<void> {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (allowed !== null && !allowed.includes(branchId)) {
      throw new ForbiddenException('Branch not in your scope');
    }
  }

  async list(orgId: string, userId: string, branchId?: string) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
    } else if (allowed !== null && allowed.length === 0) {
      return [];
    }

    return this.withOrg(orgId, (tx) =>
      tx.stationProfile.findMany({
        where: {
          orgId,
          ...(branchId ? { branchId } : {}),
          ...(allowed !== null ? { branchId: { in: allowed } } : {}),
        },
        include: {
          primaryQueue: { select: { id: true, name: true } },
          queues: {
            orderBy: { sortOrder: 'asc' },
            include: {
              queue: {
                select: { id: true, name: true, stepRole: true, callingPolicy: true, status: true },
              },
            },
          },
        },
        orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
      }),
    );
  }

  /**
   * Picks the default station profile for a branch, auto-generating from the active flow when none exist.
   * Keeps station profiles as an implementation detail — no separate Counters admin required.
   */
  async resolveDefaultProfileForBranch(
    orgId: string,
    userId: string,
    branchId: string,
    deskNumber?: string,
  ): Promise<string> {
    await this.assertBranchInScope(orgId, userId, branchId);

    let profile = await this.withOrg(orgId, (tx) =>
      tx.stationProfile.findFirst({
        where: { orgId, branchId, isDefault: true },
        select: { id: true },
      }),
    );
    if (!profile) {
      profile = await this.withOrg(orgId, (tx) =>
        tx.stationProfile.findFirst({
          where: { orgId, branchId },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
          select: { id: true },
        }),
      );
    }

    if (!profile) {
      const activeFlowId = await this.resolveActiveFlowTemplateId(orgId, branchId, deskNumber);
      if (activeFlowId) {
        try {
          await this.generateFromFlowTemplate(orgId, userId, activeFlowId);
        } catch (err) {
          if (!(err instanceof ConflictException)) throw err;
        }
        profile = await this.withOrg(orgId, (tx) =>
          tx.stationProfile.findFirst({
            where: { orgId, branchId, isDefault: true },
            select: { id: true },
          }),
        );
        if (!profile) {
          profile = await this.withOrg(orgId, (tx) =>
            tx.stationProfile.findFirst({
              where: { orgId, branchId },
              orderBy: { name: 'asc' },
              select: { id: true },
            }),
          );
        }
      }
    }

    if (!profile) {
      throw new BadRequestException(
        'This branch has no active flow counters yet. Activate a flow template under Flows.',
      );
    }
    return profile.id;
  }

  /**
   * Journey view needs every flow step actionable (including pickup), not the default Front desk profile
   * where pickup lanes are visibility-only.
   */
  async resolveActiveFlowTemplateId(
    orgId: string,
    branchId: string,
    deskNumber?: string,
    queueId?: string,
  ): Promise<string | null> {
    if (queueId) {
      const linkedQueue = await this.withOrg(orgId, (tx) =>
        tx.queue.findFirst({
          where: { id: queueId, orgId, branchId },
          select: { flowTemplateId: true },
        }),
      );
      if (linkedQueue?.flowTemplateId) return linkedQueue.flowTemplateId;
    }

    if (deskNumber) {
      const match = await this.withOrg(orgId, (tx) =>
        tx.branchFlowTemplate.findFirst({
          where: {
            orgId,
            branchId,
            steps: { some: { deskNumber } },
          },
          select: { id: true },
        }),
      );
      if (match) return match.id;
    }

    const active = await this.withOrg(orgId, (tx) =>
      tx.branchFlowTemplate.findFirst({
        where: { orgId, branchId, isActive: true },
        select: { id: true },
      }),
    );
    return active?.id ?? null;
  }

  async resolveJourneyProfileForBranch(
    orgId: string,
    userId: string,
    branchId: string,
    deskNumber?: string,
    queueId?: string,
  ): Promise<string> {
    await this.assertBranchInScope(orgId, userId, branchId);

    const journeyProfileId = await this.provisionJourneyStationProfiles(
      orgId,
      userId,
      branchId,
      deskNumber,
      queueId,
    );
    if (journeyProfileId) return journeyProfileId;

    return this.resolveDefaultProfileForBranch(orgId, userId, branchId, deskNumber);
  }

  /**
   * Ensures the combined journey station profile exists and every flow-step queue is actionable (not view-only).
   * Call when activating a flow or loading the journey workbench.
   */
  async provisionJourneyStationProfiles(
    orgId: string,
    userId: string,
    branchId: string,
    deskNumber?: string,
    queueId?: string,
  ): Promise<string | null> {
    const activeFlowId = await this.resolveActiveFlowTemplateId(
      orgId,
      branchId,
      deskNumber,
      queueId,
    );
    if (!activeFlowId) return null;

    const combinedId = await this.ensureCombinedCounterProfile(orgId, userId, activeFlowId);
    if (!combinedId) return null;

    await this.repairJourneyProfileQueues(orgId, combinedId, activeFlowId);
    return combinedId;
  }

  /**
   * Repairs and syncs every station profile linked to a flow template.
   * Intended to be called after flow edits/activation so desks update without waiting for workbench load.
   */
  async repairJourneyProfilesForFlowTemplate(orgId: string, flowTemplateId: string): Promise<void> {
    const profiles = await this.withOrg(orgId, (tx) =>
      tx.stationProfile.findMany({
        where: { orgId, flowTemplateId },
        select: { id: true },
      }),
    );
    for (const profile of profiles) {
      await this.repairJourneyProfileQueues(orgId, profile.id, flowTemplateId);
    }
  }

  /**
   * Creates the combined journey station profile when missing (common for flows provisioned before it existed).
   * Gives every flow step real actions on the journey page, including mark_ready on pickup lanes.
   */
  async ensureCombinedCounterProfile(
    orgId: string,
    userId: string,
    flowTemplateId: string,
  ): Promise<string | null> {
    const template = await this.withOrg(orgId, (tx) =>
      tx.branchFlowTemplate.findFirst({
        where: { id: flowTemplateId, orgId },
        include: {
          steps: {
            orderBy: { stepIndex: 'asc' },
            include: {
              queue: { select: { id: true, name: true, stepRole: true, callingPolicy: true } },
            },
          },
        },
      }),
    );
    if (!template?.steps.length) return null;

    const existing = await this.withOrg(orgId, (tx) =>
      tx.stationProfile.findFirst({
        where: {
          orgId,
          branchId: template.branchId,
          flowTemplateId: template.id,
          name: {
            in: [
              COMBINED_JOURNEY_STATION_PROFILE_NAME,
              LEGACY_COMBINED_JOURNEY_STATION_PROFILE_NAME,
            ],
          },
        },
        select: { id: true },
      }),
    );
    if (existing) {
      await this.repairJourneyProfileQueues(orgId, existing.id, template.id);
      return existing.id;
    }

    const serviceSteps = template.steps.filter(
      (s) => s.queueId && (s.stepRole === 'service' || !s.stepRole),
    );
    const pickupSteps = template.steps.filter((s) => s.queueId && s.stepRole === 'pickup');
    const stepsWithQueue = template.steps.filter((s) => s.queueId);
    if (!stepsWithQueue.length) return null;

    const combinedQueues =
      serviceSteps.length > 0 && pickupSteps.length > 0
        ? template.steps.filter((s) => s.queueId)
        : stepsWithQueue.length >= 2
          ? stepsWithQueue
          : null;
    if (!combinedQueues?.length) return null;

    const created = await this.create(orgId, userId, {
      branchId: template.branchId,
      name: COMBINED_JOURNEY_STATION_PROFILE_NAME,
      primaryQueueId: combinedQueues[0]!.queueId!,
      flowTemplateId: template.id,
      queues: combinedQueues.map((s, i) => ({
        queueId: s.queueId!,
        sortOrder: i,
        visibilityOnly: false,
        capabilities:
          s.stepRole === 'pickup' ? DEFAULT_PICKUP_CAPABILITIES : DEFAULT_COMBINED_CAPABILITIES,
      })),
    });

    const createdId = (created as { id: string }).id;
    await this.repairJourneyProfileQueues(orgId, createdId, template.id);
    return createdId;
  }

  /**
   * Fixes combined journey profile rows that were created as view-only pickup (legacy Front desk pattern).
   */
  async repairJourneyProfileQueues(
    orgId: string,
    stationProfileId: string,
    flowTemplateId: string,
  ): Promise<boolean> {
    const steps = await this.withOrg(orgId, (tx) =>
      tx.branchFlowStep.findMany({
        where: { orgId, templateId: flowTemplateId },
        orderBy: { stepIndex: 'asc' },
        select: { queueId: true, stepRole: true },
      }),
    );

    const profileQueues = await this.withOrg(orgId, (tx) =>
      tx.stationProfileQueue.findMany({
        where: { orgId, stationProfileId },
        select: { queueId: true, visibilityOnly: true, capabilities: true },
      }),
    );
    const profileByQueue = new Map(profileQueues.map((q) => [q.queueId, q]));
    const needsRepair = steps.some((step) => {
      if (!step.queueId) return false;
      const row = profileByQueue.get(step.queueId);
      if (!row || row.visibilityOnly) return true;
      const expected = capabilitiesForJourneyFlowStep(step.stepRole);
      const actual = Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [];
      return expected.some((cap) => !actual.includes(cap));
    });
    const missingQueue = steps.some((step) => step.queueId && !profileByQueue.has(step.queueId));
    if (!needsRepair && !missingQueue) return false;

    await this.withOrg(
      orgId,
      async (tx) => {
        for (const step of steps) {
          if (!step.queueId) continue;
          const capabilities = capabilitiesForJourneyFlowStep(step.stepRole);
          await tx.stationProfileQueue.updateMany({
            where: { orgId, stationProfileId, queueId: step.queueId! },
            data: {
              visibilityOnly: false,
              capabilities,
            },
          });
        }
      },
      JOURNEY_PROFILE_TX_OPTIONS,
    );

    await this.syncMissingJourneyProfileQueues(orgId, stationProfileId, flowTemplateId);
    return true;
  }

  /**
   * Adds flow-step queues that were linked after the station profile was created (common after Flow edits).
   */
  private async syncMissingJourneyProfileQueues(
    orgId: string,
    stationProfileId: string,
    flowTemplateId: string,
  ): Promise<void> {
    const steps = await this.withOrg(orgId, (tx) =>
      tx.branchFlowStep.findMany({
        where: { orgId, templateId: flowTemplateId },
        orderBy: { stepIndex: 'asc' },
        select: { queueId: true, stepRole: true },
      }),
    );

    const profile = await this.withOrg(orgId, (tx) =>
      tx.stationProfile.findFirst({
        where: { id: stationProfileId, orgId },
        select: {
          branchId: true,
          queues: { select: { queueId: true, sortOrder: true } },
        },
      }),
    );
    if (!profile) return;

    const existingIds = new Set(profile.queues.map((q) => q.queueId));
    const missing = steps.filter((s) => s.queueId && !existingIds.has(s.queueId!));
    if (!missing.length) return;

    await this.validateQueues(
      orgId,
      profile.branchId,
      missing.map((s) => s.queueId!),
    );

    let nextSort = profile.queues.reduce((max, q) => Math.max(max, q.sortOrder), -1) + 1;

    await this.withOrg(
      orgId,
      (tx) =>
        tx.stationProfileQueue.createMany({
          data: missing.map((step) => ({
            orgId,
            stationProfileId,
            queueId: step.queueId!,
            sortOrder: nextSort++,
            visibilityOnly: false,
            capabilities: capabilitiesForJourneyFlowStep(step.stepRole) as unknown as object,
          })),
          skipDuplicates: true,
        }),
      JOURNEY_PROFILE_TX_OPTIONS,
    );
  }

  async getById(orgId: string, userId: string, id: string) {
    const profile = await this.withOrg(orgId, (tx) =>
      tx.stationProfile.findFirst({
        where: { id, orgId },
        include: {
          primaryQueue: { select: { id: true, name: true } },
          queues: {
            orderBy: { sortOrder: 'asc' },
            include: {
              queue: {
                select: { id: true, name: true, stepRole: true, callingPolicy: true, status: true },
              },
            },
          },
        },
      }),
    );
    if (!profile) throw new NotFoundException('Station profile not found');
    await this.assertBranchInScope(orgId, userId, profile.branchId);
    return profile;
  }

  async create(orgId: string, userId: string, input: CreateStationProfileInput) {
    const branch = await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.findFirst({ where: { id: input.branchId, orgId } }),
    );
    if (!branch) throw new NotFoundException('Branch not found');
    await this.assertBranchInScope(orgId, userId, input.branchId);
    if (!input.queues.length) throw new BadRequestException('At least one queue is required');

    await this.validateQueues(
      orgId,
      input.branchId,
      input.queues.map((q) => q.queueId),
    );
    if (input.primaryQueueId && !input.queues.some((q) => q.queueId === input.primaryQueueId)) {
      throw new BadRequestException('primaryQueueId must be one of the profile queues');
    }

    return this.withOrg(orgId, (tx) =>
      tx.stationProfile.create({
        data: {
          orgId,
          branchId: input.branchId,
          name: input.name,
          primaryQueueId: input.primaryQueueId ?? input.queues[0]?.queueId ?? null,
          flowTemplateId: input.flowTemplateId ?? null,
          isDefault: input.isDefault ?? false,
          queues: {
            create: input.queues.map((q, index) => ({
              orgId,
              queueId: q.queueId,
              sortOrder: q.sortOrder ?? index,
              visibilityOnly: q.visibilityOnly ?? false,
              capabilities: (q.capabilities ?? DEFAULT_SERVICE_CAPABILITIES) as unknown as object,
            })),
          },
        },
        include: {
          queues: { include: { queue: { select: { id: true, name: true } } } },
        },
      }),
    );
  }

  async update(
    orgId: string,
    userId: string,
    id: string,
    input: Partial<CreateStationProfileInput>,
  ) {
    await this.getById(orgId, userId, id);

    if (input.queues) {
      if (!input.queues.length) throw new BadRequestException('At least one queue is required');
      const profile = await this.getById(orgId, userId, id);
      await this.validateQueues(
        orgId,
        profile.branchId,
        input.queues.map((q) => q.queueId),
      );

      const queues = input.queues;
      await this.withOrg(orgId, async (tx) => {
        await tx.stationProfileQueue.deleteMany({ where: { stationProfileId: id, orgId } });
        await tx.stationProfile.update({
          where: { id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.primaryQueueId !== undefined ? { primaryQueueId: input.primaryQueueId } : {}),
            ...(input.flowTemplateId !== undefined ? { flowTemplateId: input.flowTemplateId } : {}),
            ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
            queues: {
              create: queues.map((q, index) => ({
                orgId,
                queueId: q.queueId,
                sortOrder: q.sortOrder ?? index,
                visibilityOnly: q.visibilityOnly ?? false,
                capabilities: (q.capabilities ?? DEFAULT_SERVICE_CAPABILITIES) as unknown as object,
              })),
            },
          },
        });
      });
      return this.getById(orgId, userId, id);
    }

    return this.withOrg(orgId, (tx) =>
      tx.stationProfile.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.primaryQueueId !== undefined ? { primaryQueueId: input.primaryQueueId } : {}),
          ...(input.flowTemplateId !== undefined ? { flowTemplateId: input.flowTemplateId } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
        include: {
          queues: { include: { queue: { select: { id: true, name: true } } } },
        },
      }),
    );
  }

  async delete(orgId: string, userId: string, id: string) {
    await this.getById(orgId, userId, id);
    await this.prisma.withTenant(orgId, (tx) =>
      tx.desk.updateMany({
        where: { orgId, defaultStationProfileId: id },
        data: { defaultStationProfileId: null },
      }),
    );
    await this.withOrg(orgId, (tx) => tx.stationProfile.delete({ where: { id } }));
  }

  /**
   * Creates default Front desk + Pickup window profiles from an active flow template.
   */
  async generateFromFlowTemplate(
    orgId: string,
    userId: string,
    templateId: string,
    requestedBranchId?: string,
  ) {
    const template = await this.withOrg(orgId, (tx) =>
      tx.branchFlowTemplate.findFirst({
        where: { id: templateId, orgId },
        include: {
          steps: {
            orderBy: { stepIndex: 'asc' },
            include: {
              queue: { select: { id: true, name: true, stepRole: true, callingPolicy: true } },
            },
          },
        },
      }),
    );
    if (!template) throw new NotFoundException('Flow template not found');
    if (!template.steps.length) throw new BadRequestException('Flow template has no steps');
    if (requestedBranchId && requestedBranchId !== template.branchId) {
      throw new BadRequestException('branchId does not match the flow template branch');
    }
    await this.assertBranchInScope(orgId, userId, template.branchId);

    const serviceSteps = template.steps.filter(
      (s) => s.queueId && (s.stepRole === 'service' || !s.stepRole),
    );
    const pickupSteps = template.steps.filter((s) => s.queueId && s.stepRole === 'pickup');

    const existing = await this.withOrg(orgId, (tx) =>
      tx.stationProfile.findMany({
        where: { orgId, branchId: template.branchId, flowTemplateId: templateId },
      }),
    );
    if (existing.length > 0) {
      throw new ConflictException('Station profiles already exist for this flow template');
    }

    const created: unknown[] = [];

    if (serviceSteps.length > 0) {
      const primaryQueueId = serviceSteps[0]!.queueId!;
      created.push(
        await this.create(orgId, userId, {
          branchId: template.branchId,
          name: 'Front desk',
          primaryQueueId,
          flowTemplateId: templateId,
          isDefault: true,
          queues: [
            ...serviceSteps.map((s, i) => ({
              queueId: s.queueId!,
              sortOrder: i,
              capabilities: DEFAULT_SERVICE_CAPABILITIES,
            })),
            ...pickupSteps.map((s, i) => ({
              queueId: s.queueId!,
              sortOrder: serviceSteps.length + i,
              visibilityOnly: true,
              capabilities: [DEFAULT_PICKUP_CAPABILITIES[0]!] as StationCapability[],
            })),
          ],
        }),
      );
    }

    if (pickupSteps.length > 0) {
      const primaryQueueId = pickupSteps[0]!.queueId!;
      const needsReady = pickupSteps.some(
        (s) => s.callingPolicy === 'ready_then_manual' || s.callingPolicy === 'ready_then_fifo',
      );
      created.push(
        await this.create(orgId, userId, {
          branchId: template.branchId,
          name: 'Pickup window',
          primaryQueueId,
          flowTemplateId: templateId,
          queues: pickupSteps.map((s, i) => ({
            queueId: s.queueId!,
            sortOrder: i,
            capabilities: needsReady ? DEFAULT_PICKUP_CAPABILITIES : DEFAULT_SERVICE_CAPABILITIES,
          })),
        }),
      );
    }

    if (serviceSteps.length > 0 && pickupSteps.length > 0) {
      created.push(
        await this.create(orgId, userId, {
          branchId: template.branchId,
          name: COMBINED_JOURNEY_STATION_PROFILE_NAME,
          primaryQueueId: serviceSteps[0]!.queueId!,
          flowTemplateId: templateId,
          queues: template.steps
            .filter((s) => s.queueId)
            .map((s, i) => ({
              queueId: s.queueId!,
              sortOrder: i,
              capabilities:
                s.stepRole === 'pickup'
                  ? DEFAULT_PICKUP_CAPABILITIES
                  : DEFAULT_COMBINED_CAPABILITIES,
            })),
        }),
      );
    }

    return created;
  }

  private async validateQueues(orgId: string, branchId: string, queueIds: string[]) {
    const queues = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.findMany({
        where: { orgId, branchId, id: { in: queueIds } },
        select: { id: true },
      }),
    );
    if (queues.length !== queueIds.length) {
      throw new BadRequestException('One or more queues do not belong to this branch');
    }
  }
}
