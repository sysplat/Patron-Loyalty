import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isFlowEligibleQueue,
  QUEUE_CALLING_POLICIES,
  QUEUE_STEP_ROLES,
  resolveCallingPolicyForStep,
} from '@queueplatform/shared';
import { assertServicesAssignedToBranch } from './flow-public-entry';
import { assertQueuesAvailableForFlowTemplate } from './queue-setup.validation';

export type FlowStepInput = {
  stepIndex: number;
  deskNumber: string;
  serviceId: string;
  queueId: string;
  stepRole: 'service' | 'pickup';
  callingPolicy: 'fifo' | 'manual_only' | 'ready_then_manual' | 'ready_then_fifo';
};

type FlowDbClient = Prisma.TransactionClient | PrismaServiceLike;

type PrismaServiceLike = {
  queue: Prisma.TransactionClient['queue'];
  desk: Prisma.TransactionClient['desk'];
  branchFlowTemplate: Prisma.TransactionClient['branchFlowTemplate'];
  service: Prisma.TransactionClient['service'];
};

export function normalizeFlowDeskNumber(input: string): string {
  const digitsOnly = String(input ?? '').replace(/\D/g, '');
  if (!digitsOnly) throw new BadRequestException('Step desk is required');
  return String(Math.max(1, Number.parseInt(digitsOnly, 10)));
}

export function normalizeFlowStepRole(input: string): FlowStepInput['stepRole'] {
  if ((QUEUE_STEP_ROLES as readonly string[]).includes(input)) {
    return input as FlowStepInput['stepRole'];
  }
  throw new BadRequestException('Invalid step role');
}

export function normalizeFlowCallingPolicy(input: string): FlowStepInput['callingPolicy'] {
  if ((QUEUE_CALLING_POLICIES as readonly string[]).includes(input)) {
    return input as FlowStepInput['callingPolicy'];
  }
  throw new BadRequestException('Invalid calling policy');
}

export function validateFlowStepInvariants(step: FlowStepInput): void {
  if (step.stepRole === 'pickup' && step.callingPolicy === 'fifo') {
    throw new BadRequestException('Pickup steps cannot use fifo calling policy');
  }
}

export function normalizeFlowSteps(steps: FlowStepInput[]): FlowStepInput[] {
  return steps.map((step) => {
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
}

export function assertFlowTemplateStepCount(steps: FlowStepInput[]): void {
  if (!steps.length || steps.length < 2) {
    throw new BadRequestException('Multi-step templates require at least two steps');
  }
}

export function assertFirstFlowStepIsService(steps: FlowStepInput[]): void {
  const firstStep = [...steps].sort((a, b) => a.stepIndex - b.stepIndex)[0];
  if (firstStep?.stepRole === 'pickup') {
    throw new BadRequestException('Flow step 1 must use "service" queue type.');
  }
}

export async function assertFlowStepDeskScope(
  tx: FlowDbClient,
  orgId: string,
  branchId: string,
  steps: FlowStepInput[],
): Promise<void> {
  const deskNumbers = steps.map((step) => step.deskNumber);

  const uniqueDeskNumbers = [...new Set(deskNumbers)];
  const desks = await tx.desk.findMany({
    where: { orgId, branchId, number: { in: uniqueDeskNumbers } },
    select: { number: true },
  });
  if (desks.length !== uniqueDeskNumbers.length) {
    const existing = new Set(desks.map((d) => d.number));
    const missing = uniqueDeskNumbers.filter((number) => !existing.has(number));
    throw new BadRequestException(
      `Step desk not configured in this branch: ${missing.map((n) => `Desk ${n}`).join(', ')}`,
    );
  }
}

export async function assertFlowStepQueueScope(
  tx: FlowDbClient,
  orgId: string,
  branchId: string,
  steps: FlowStepInput[],
  allowedTemplateId?: string,
): Promise<void> {
  const queueIds = steps.map((step) => step.queueId);
  if (new Set(queueIds).size !== queueIds.length) {
    throw new BadRequestException('Each step must use a different queue');
  }

  const uniqueQueueIds = [...new Set(queueIds)];
  const serviceIds = [...new Set(steps.map((step) => step.serviceId))];
  const queues = await tx.queue.findMany({
    where: { orgId, id: { in: uniqueQueueIds } },
    select: {
      id: true,
      branchId: true,
      serviceId: true,
      journeyModeOverride: true,
      name: true,
      flowTemplateId: true,
    },
  });

  if (queues.length !== uniqueQueueIds.length) {
    throw new NotFoundException('One or more queues were not found');
  }

  await assertServicesAssignedToBranch(tx, orgId, branchId, serviceIds);
  await assertQueuesAvailableForFlowTemplate(tx, orgId, uniqueQueueIds, allowedTemplateId);

  for (const step of steps) {
    const queue = queues.find((item) => item.id === step.queueId);
    if (!queue) throw new NotFoundException('Queue not found');
    if (queue.branchId !== branchId) {
      throw new BadRequestException(
        'Each step queue must belong to the same branch as the template',
      );
    }
    if (queue.serviceId !== step.serviceId) {
      throw new BadRequestException('Step service must match the queue service');
    }
    if (!isFlowEligibleQueue(queue.journeyModeOverride)) {
      throw new BadRequestException(
        `Queue "${queue.name}" must use multi-step process flow to be included in a flow template`,
      );
    }
  }
}

export async function syncFlowQueuesFromSteps(
  tx: Prisma.TransactionClient,
  orgId: string,
  steps: FlowStepInput[],
): Promise<void> {
  for (const step of steps) {
    await tx.queue.update({
      where: { id: step.queueId, orgId },
      data: {
        stepRole: step.stepRole,
        callingPolicy: resolveCallingPolicyForStep(step.stepRole, step.callingPolicy),
        journeyModeOverride: 'visit_multi_step',
      },
    });
  }
}

export async function createLinkedFlowTemplate(
  tx: Prisma.TransactionClient,
  orgId: string,
  input: {
    branchId: string;
    name: string;
    steps: FlowStepInput[];
    activate?: boolean;
  },
) {
  await assertFlowStepQueueScope(tx, orgId, input.branchId, input.steps);
  await assertFlowStepDeskScope(tx, orgId, input.branchId, input.steps);

  const created = await tx.branchFlowTemplate.create({
    data: {
      orgId,
      branchId: input.branchId,
      name: input.name.trim(),
      isActive: false,
      steps: {
        create: input.steps.map((step) => ({
          orgId,
          stepIndex: step.stepIndex,
          deskNumber: step.deskNumber,
          serviceId: step.serviceId,
          queueId: step.queueId,
          stepRole: step.stepRole,
          callingPolicy: step.callingPolicy,
        })),
      },
    },
    include: { steps: true },
  });

  await tx.queue.updateMany({
    where: { orgId, id: { in: input.steps.map((step) => step.queueId) } },
    data: { flowTemplateId: created.id },
  });
  await syncFlowQueuesFromSteps(tx, orgId, input.steps);

  if (input.activate) {
    await tx.branchFlowTemplate.updateMany({
      where: { orgId, branchId: input.branchId },
      data: { isActive: false },
    });
    await tx.branchFlowTemplate.update({
      where: { id: created.id },
      data: { isActive: true },
    });
  }

  return created;
}
