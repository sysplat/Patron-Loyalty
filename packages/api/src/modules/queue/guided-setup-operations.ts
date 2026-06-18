import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  generateSlug,
  resolveCallingPolicyForStep,
  type GuidedSetupDeployInput,
} from '@queueplatform/shared';
import { assertServicesAssignedToBranch } from './flow-public-entry';
import {
  assertQueuePrefixAvailable,
  assertServiceAssignedToBranchForQueue,
} from './queue-setup.validation';
import type { FlowStepInput } from './flow-template-operations';
import { normalizeFlowDeskNumber } from './flow-template-operations';

export async function resolveGuidedServiceId(
  tx: Prisma.TransactionClient,
  orgId: string,
  branchId: string,
  service: GuidedSetupDeployInput['service'],
  journeyMode: 'single_ticket' | 'visit_multi_step',
): Promise<string> {
  if (service.mode === 'existing') {
    await assertServicesAssignedToBranch(tx, orgId, branchId, [service.serviceId]);
    if (journeyMode === 'visit_multi_step') {
      await tx.service.update({
        where: { id: service.serviceId, orgId },
        data: { journeyModeOverride: 'visit_multi_step' },
      });
    }
    return service.serviceId;
  }

  const slug = generateSlug(service.name);
  const existing = await tx.service.findFirst({ where: { orgId, slug } });
  if (existing) throw new ConflictException('A service with this name already exists');

  const created = await tx.service.create({
    data: {
      orgId,
      name: service.name,
      slug,
      description: service.description,
      durationMinutes: service.durationMinutes,
      queueEnabled: true,
      appointmentEnabled: false,
      serviceEstimateLowMinutes: service.serviceEstimateLowMinutes,
      serviceEstimateHighMinutes: service.serviceEstimateHighMinutes,
      journeyModeOverride: journeyMode,
      instructionalTip: service.instructionalTip ?? null,
    },
  });

  await tx.branchService.create({
    data: { branchId, serviceId: created.id },
  });

  return created.id;
}

type CreateGuidedQueueInput = {
  orgId: string;
  branchId: string;
  serviceId: string;
  name: string;
  prefix: string;
  journeyModeOverride: 'single_ticket' | 'visit_multi_step';
  stepRole: FlowStepInput['stepRole'] | null;
  callingPolicy: FlowStepInput['callingPolicy'];
};

export async function createGuidedQueue(
  tx: Prisma.TransactionClient,
  input: CreateGuidedQueueInput,
): Promise<string> {
  await assertServiceAssignedToBranchForQueue(tx, input.orgId, input.branchId, input.serviceId);
  await assertQueuePrefixAvailable(tx, input.orgId, input.branchId, input.prefix);

  const service = await tx.service.findFirst({
    where: { id: input.serviceId, orgId: input.orgId },
    select: { durationMinutes: true },
  });
  if (!service) throw new NotFoundException('Service not found');

  const queue = await tx.queue.create({
    data: {
      orgId: input.orgId,
      branchId: input.branchId,
      serviceId: input.serviceId,
      name: input.name,
      prefix: input.prefix.toUpperCase(),
      maxServiceMinutes: service.durationMinutes ?? 15,
      journeyModeOverride: input.journeyModeOverride,
      stepRole: input.stepRole,
      callingPolicy: resolveCallingPolicyForStep(input.stepRole, input.callingPolicy),
      status: 'closed',
    },
  });

  return queue.id;
}

export function buildGuidedMultiFlowSteps(
  payload: Extract<GuidedSetupDeployInput, { flowType: 'multi' }>,
): FlowStepInput[] {
  return payload.steps.map((step, index) => {
    if (step.stepRole === 'pickup' && step.callingPolicy === 'fifo') {
      throw new BadRequestException('Pickup steps cannot use fifo calling policy');
    }
    if (index === 0 && step.stepRole !== 'service') {
      throw new BadRequestException('Flow step 1 must use "service" queue type.');
    }
    return {
      stepIndex: index + 1,
      deskNumber: normalizeFlowDeskNumber(step.deskNumber),
      serviceId: '',
      queueId: '',
      stepRole: step.stepRole,
      callingPolicy: step.callingPolicy,
    };
  });
}
