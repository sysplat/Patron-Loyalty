import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SYSTEM_ROLES } from '@queueplatform/shared';
import {
  assertFirstFlowStepIsService,
  assertFlowStepDeskScope,
  assertFlowStepQueueScope,
  assertFlowTemplateStepCount,
  createLinkedFlowTemplate,
  normalizeFlowCallingPolicy,
  normalizeFlowDeskNumber,
  normalizeFlowStepRole,
  syncFlowQueuesFromSteps,
  validateFlowStepInvariants,
  type FlowStepInput,
} from './flow-template-operations';
import { StationProfileService } from '../workbench/station-profile.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { resolveUserHighestSystemRole } from '../../common/rbac/role-assignment-authorization';

/**
 * Service for managing flow templates, which define multi-step queue journeys.
 * Handles validation, creation, updating, and activation of flow templates.
 */
@Injectable()
export class FlowTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stationProfileService: StationProfileService,
  ) {}

  /**
   * Validates if the user has permission to manage flow templates in the given branch.
   * Requires Owner/Admin system role, or Manager role with explicit branch access.
   */
  private async assertCanManageFlowTemplates(
    orgId: string,
    actorUserId: string,
    targetBranchId?: string,
  ): Promise<void> {
    const role = await resolveUserHighestSystemRole(this.prisma, orgId, actorUserId);
    if (role === SYSTEM_ROLES.OWNER || role === SYSTEM_ROLES.ADMIN) {
      return;
    }
    if (role === SYSTEM_ROLES.MANAGER && targetBranchId) {
      const allowedBranches = await resolveAllowedBranchIds(this.prisma, orgId, actorUserId);
      if (allowedBranches?.includes(targetBranchId)) {
        return;
      }
      throw new ForbiddenException(
        'Managers can only manage flow templates in branches assigned to them.',
      );
    }
    throw new ForbiddenException(
      'Flow templates are restricted to owners, admins, and branch managers.',
    );
  }

  /**
   * Retrieves all flow templates for a given branch.
   * Requires appropriate RBAC permissions.
   */
  async list(orgId: string, actorUserId: string, branchId: string) {
    await this.assertCanManageFlowTemplates(orgId, actorUserId, branchId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.branchFlowTemplate.findMany({
        where: { orgId, branchId },
        include: {
          steps: {
            orderBy: { stepIndex: 'asc' },
            include: {
              queue: { select: { id: true, name: true } },
              service: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  }

  /**
   * Creates a new flow template with its associated steps.
   * Enforces rules such as the first step must be a 'service' step.
   * Automatically updates referenced queues to link to this template.
   */
  async create(
    orgId: string,
    actorUserId: string,
    data: { branchId: string; name: string; steps: FlowStepInput[] },
  ) {
    await this.assertCanManageFlowTemplates(orgId, actorUserId, data.branchId);
    assertFlowTemplateStepCount(data.steps);
    const normalizedSteps = data.steps.map((step) => {
      const normalized: FlowStepInput = {
        stepIndex: step.stepIndex,
        deskNumber: normalizeFlowDeskNumber(step.deskNumber),
        serviceId: step.serviceId,
        queueId: step.queueId,
        stepRole: normalizeFlowStepRole(step.stepRole),
        callingPolicy: normalizeFlowCallingPolicy(step.callingPolicy),
      };
      validateFlowStepInvariants(normalized);
      return normalized;
    });
    assertFirstFlowStepIsService(normalizedSteps);

    const template = await this.prisma.withTenant(orgId, async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: data.branchId, orgId },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException('Branch not found');
      return createLinkedFlowTemplate(tx, orgId, {
        branchId: data.branchId,
        name: data.name,
        steps: normalizedSteps,
      });
    });
    await this.stationProfileService.repairJourneyProfilesForFlowTemplate(orgId, template.id);
    return template;
  }

  /**
   * Updates an existing flow template.
   * If steps are provided, replaces all existing steps with the new list,
   * unlinks old queues, and links new queues to the template.
   */
  async update(
    orgId: string,
    actorUserId: string,
    id: string,
    data: { name?: string; steps?: FlowStepInput[] },
  ) {
    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.branchFlowTemplate.findFirst({
        where: { id, orgId },
        select: { id: true, branchId: true },
      }),
    );
    if (!existing) throw new NotFoundException('Flow template not found');
    await this.assertCanManageFlowTemplates(orgId, actorUserId, existing.branchId);

    const normalizedSteps = data.steps?.map((step) => {
      const normalized: FlowStepInput = {
        stepIndex: step.stepIndex,
        deskNumber: normalizeFlowDeskNumber(step.deskNumber),
        serviceId: step.serviceId,
        queueId: step.queueId,
        stepRole: normalizeFlowStepRole(step.stepRole),
        callingPolicy: normalizeFlowCallingPolicy(step.callingPolicy),
      };
      validateFlowStepInvariants(normalized);
      return normalized;
    });

    if (normalizedSteps) {
      assertFlowTemplateStepCount(normalizedSteps);
      assertFirstFlowStepIsService(normalizedSteps);
    }

    const updated = await this.prisma.withTenant(orgId, async (tx) => {
      if (normalizedSteps) {
        await assertFlowStepQueueScope(tx, orgId, existing.branchId, normalizedSteps, id);
        await assertFlowStepDeskScope(tx, orgId, existing.branchId, normalizedSteps);
        await tx.branchFlowStep.deleteMany({ where: { orgId, templateId: id } });
      }

      const next = await tx.branchFlowTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(normalizedSteps
            ? {
                steps: {
                  create: normalizedSteps.map((step) => ({
                    orgId,
                    stepIndex: step.stepIndex,
                    deskNumber: step.deskNumber,
                    serviceId: step.serviceId,
                    queueId: step.queueId,
                    stepRole: step.stepRole,
                    callingPolicy: step.callingPolicy,
                  })),
                },
              }
            : {}),
        },
        include: {
          steps: {
            orderBy: { stepIndex: 'asc' },
            include: {
              queue: { select: { id: true, name: true } },
              service: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (normalizedSteps) {
        await tx.queue.updateMany({
          where: { orgId, branchId: existing.branchId, flowTemplateId: id },
          data: { flowTemplateId: null },
        });
        await tx.queue.updateMany({
          where: { orgId, id: { in: normalizedSteps.map((step) => step.queueId) } },
          data: { flowTemplateId: id },
        });
        await syncFlowQueuesFromSteps(tx, orgId, normalizedSteps);
      }

      return next;
    });
    if (normalizedSteps) {
      await this.stationProfileService.repairJourneyProfilesForFlowTemplate(orgId, id);
    }
    return updated;
  }

  /**
   * Activates a flow template for a branch, deactivating any currently active template.
   * Synchronizes the queue configurations with the newly activated template.
   * Optionally provisions a station profile for the acting user.
   */
  async activate(orgId: string, actorUserId: string, id: string, userId?: string) {
    const template = await this.prisma.withTenant(orgId, (tx) =>
      tx.branchFlowTemplate.findFirst({
        where: { id, orgId },
        select: { id: true, branchId: true },
      }),
    );
    if (!template) throw new NotFoundException('Flow template not found');
    await this.assertCanManageFlowTemplates(orgId, actorUserId, template.branchId);

    const activated = await this.prisma.withTenant(orgId, async (tx) => {
      const steps = await tx.branchFlowStep.findMany({
        where: { orgId, templateId: id },
        orderBy: { stepIndex: 'asc' },
      });

      const activeTemplates = await tx.branchFlowTemplate.findMany({
        where: { orgId, branchId: template.branchId, isActive: true, id: { not: id } },
        include: { steps: true },
      });

      const newQueueIds = steps.map((s) => s.queueId).filter(Boolean);
      const activeQueueIds = activeTemplates.flatMap((t) =>
        t.steps.map((s) => s.queueId).filter(Boolean),
      );
      const overlappingQueueId = newQueueIds.find((q) => activeQueueIds.includes(q));

      if (overlappingQueueId) {
        throw new BadRequestException(
          'Cannot activate template: one or more queues are already used by another active template.',
        );
      }

      if (steps.length > 0) {
        const normalizedSteps: FlowStepInput[] = steps.map((step) => ({
          stepIndex: step.stepIndex,
          deskNumber: normalizeFlowDeskNumber(step.deskNumber),
          serviceId: step.serviceId,
          queueId: step.queueId!,
          stepRole: normalizeFlowStepRole(step.stepRole),
          callingPolicy: normalizeFlowCallingPolicy(step.callingPolicy),
        }));
        await tx.queue.updateMany({
          where: { orgId, branchId: template.branchId, flowTemplateId: id },
          data: { flowTemplateId: null },
        });
        await tx.queue.updateMany({
          where: { orgId, id: { in: normalizedSteps.map((step) => step.queueId) } },
          data: { flowTemplateId: id },
        });
        await syncFlowQueuesFromSteps(tx, orgId, normalizedSteps);
      }

      return tx.branchFlowTemplate.update({
        where: { id },
        data: { isActive: true },
        include: {
          steps: {
            orderBy: { stepIndex: 'asc' },
            include: {
              queue: { select: { id: true, name: true } },
              service: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    let stationProfileId: string | null = null;
    if (userId) {
      stationProfileId = await this.stationProfileService.provisionJourneyStationProfiles(
        orgId,
        userId,
        template.branchId,
      );
    }
    await this.stationProfileService.repairJourneyProfilesForFlowTemplate(orgId, id);

    return {
      ...activated,
      activationSummary: {
        queueIds: activated.steps
          .map((step) => step.queueId)
          .filter((queueId): queueId is string => Boolean(queueId)),
        stepCount: activated.steps.length,
        stationProfileId,
      },
    };
  }

  /**
   * Deactivates a flow template for a branch.
   * Unlinks any queues associated with it, returning them to standard behavior.
   */
  async deactivate(orgId: string, actorUserId: string, id: string) {
    const template = await this.prisma.withTenant(orgId, (tx) =>
      tx.branchFlowTemplate.findFirst({
        where: { id, orgId },
        select: { id: true, branchId: true },
      }),
    );
    if (!template) throw new NotFoundException('Flow template not found');
    await this.assertCanManageFlowTemplates(orgId, actorUserId, template.branchId);

    const deactivated = await this.prisma.withTenant(orgId, async (tx) => {
      await tx.queue.updateMany({
        where: { orgId, branchId: template.branchId, flowTemplateId: id },
        data: { flowTemplateId: null },
      });

      return tx.branchFlowTemplate.update({
        where: { id },
        data: { isActive: false },
        include: {
          steps: {
            orderBy: { stepIndex: 'asc' },
            include: {
              queue: { select: { id: true, name: true } },
              service: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    await this.stationProfileService.repairJourneyProfilesForFlowTemplate(orgId, id);

    return deactivated;
  }

  /**
   * Deletes a flow template and unlinks any queues associated with it.
   */
  async remove(orgId: string, actorUserId: string, id: string) {
    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.branchFlowTemplate.findFirst({
        where: { id, orgId },
        select: { id: true, branchId: true },
      }),
    );
    if (!existing) throw new NotFoundException('Flow template not found');
    await this.assertCanManageFlowTemplates(orgId, actorUserId, existing.branchId);

    await this.prisma.withTenant(orgId, async (tx) => {
      await tx.queue.updateMany({
        where: { orgId, flowTemplateId: id },
        data: { flowTemplateId: null },
      });
      await tx.branchFlowTemplate.delete({ where: { id } });
    });
  }
}
