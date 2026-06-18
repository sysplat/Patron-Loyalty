import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type GuidedSetupDeployInput } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitService } from '../billing/plan-limit.service';
import { StationProfileService } from '../workbench/station-profile.service';
import { userIsOrganizationOwnerOrAdmin } from '../../common/rbac/org-owner.util';
import {
  buildGuidedMultiFlowSteps,
  createGuidedQueue,
  resolveGuidedServiceId,
} from './guided-setup-operations';
import { createLinkedFlowTemplate } from './flow-template-operations';

@Injectable()
export class GuidedSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitService,
    private readonly stationProfileService: StationProfileService,
  ) {}

  private async assertOwnerOrAdmin(orgId: string, actorUserId: string): Promise<void> {
    const allowed = await userIsOrganizationOwnerOrAdmin(this.prisma, orgId, actorUserId);
    if (!allowed) {
      throw new ForbiddenException(
        'Step-by-step builder is limited to organization owners and admins.',
      );
    }
  }

  private async checkQueueLimit(
    tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0],
    orgId: string,
    branchId: string,
  ) {
    const currentQueueCount = await tx.queue.count({ where: { branchId, orgId } });
    const limitCheck = await this.planLimits.checkLimit(
      orgId,
      'maxQueuesPerBranch',
      currentQueueCount,
    );
    if (limitCheck.limitReached) {
      throw new ForbiddenException(
        `Queue limit reached for this branch. Your plan allows ${limitCheck.limit} queues per branch. Please upgrade to add more.`,
      );
    }
  }

  async deploy(orgId: string, actorUserId: string, payload: GuidedSetupDeployInput) {
    await this.assertOwnerOrAdmin(orgId, actorUserId);

    const branch = await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.findFirst({ where: { id: payload.branchId, orgId }, select: { id: true } }),
    );
    if (!branch) throw new NotFoundException('Branch not found');

    if (payload.flowType === 'single') {
      return this.deploySingle(orgId, payload);
    }
    return this.deployMulti(orgId, actorUserId, payload);
  }

  private async deploySingle(
    orgId: string,
    payload: Extract<GuidedSetupDeployInput, { flowType: 'single' }>,
  ) {
    if (payload.service.mode === 'existing' && payload.queue.mode === 'existing') {
      throw new BadRequestException('Select at least one new service or queue to deploy');
    }

    const result = await this.prisma.withTenant(orgId, async (tx) => {
      const serviceId = await resolveGuidedServiceId(
        tx,
        orgId,
        payload.branchId,
        payload.service,
        'single_ticket',
      );

      let queueId: string | undefined;
      if (payload.queue.mode === 'new') {
        await this.checkQueueLimit(tx, orgId, payload.branchId);
        queueId = await createGuidedQueue(tx, {
          orgId,
          branchId: payload.branchId,
          serviceId,
          name: payload.queue.name,
          prefix: payload.queue.prefix,
          journeyModeOverride: 'single_ticket',
          stepRole: null,
          callingPolicy: payload.queue.callingPolicy,
        });
      }

      return { flowType: 'single' as const, serviceId, queueId };
    });

    return { success: true, data: result };
  }

  private async deployMulti(
    orgId: string,
    actorUserId: string,
    payload: Extract<GuidedSetupDeployInput, { flowType: 'multi' }>,
  ) {
    const normalizedSteps = buildGuidedMultiFlowSteps(payload);

    // Service, queues, and template are created in one tenant transaction so partial deploys roll back.
    const template = await this.prisma.withTenant(orgId, async (tx) => {
      const serviceId = await resolveGuidedServiceId(
        tx,
        orgId,
        payload.branchId,
        payload.service,
        'visit_multi_step',
      );

      const queueIds: string[] = [];
      const prefixesInDeploy = new Set<string>();

      for (const [index, step] of payload.steps.entries()) {
        if (step.queue.mode === 'existing') {
          queueIds.push(step.queue.queueId);
          continue;
        }

        const prefix = step.queue.prefix.toUpperCase();
        if (prefixesInDeploy.has(prefix)) {
          throw new BadRequestException(
            `Step ${index + 1}: ticket prefix "${prefix}" is already used in this journey`,
          );
        }
        prefixesInDeploy.add(prefix);
        await this.checkQueueLimit(tx, orgId, payload.branchId);

        const queueId = await createGuidedQueue(tx, {
          orgId,
          branchId: payload.branchId,
          serviceId,
          name: step.queue.name,
          prefix,
          journeyModeOverride: 'visit_multi_step',
          stepRole: step.stepRole,
          callingPolicy: step.callingPolicy,
        });
        queueIds.push(queueId);
      }

      const stepsWithIds = normalizedSteps.map((step, index) => ({
        ...step,
        serviceId,
        queueId: queueIds[index]!,
      }));

      return createLinkedFlowTemplate(tx, orgId, {
        branchId: payload.branchId,
        name: payload.templateName,
        steps: stepsWithIds,
        activate: payload.autoActivate !== false,
      });
    });

    await this.stationProfileService.repairJourneyProfilesForFlowTemplate(orgId, template.id);
    if (payload.autoActivate !== false) {
      await this.stationProfileService.provisionJourneyStationProfiles(
        orgId,
        actorUserId,
        payload.branchId,
      );
    }

    return {
      success: true,
      data: {
        flowType: 'multi' as const,
        templateId: template.id,
        serviceId: template.steps[0]?.serviceId,
        activated: payload.autoActivate !== false,
      },
    };
  }
}
