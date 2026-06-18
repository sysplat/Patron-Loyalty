import { BadRequestException, Injectable } from '@nestjs/common';
import { resolveCallingPolicyForStep } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkbenchQueuePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  isReadyGated(policy: string): boolean {
    return policy === 'ready_then_manual' || policy === 'ready_then_fifo';
  }

  isManualCallingPolicy(policy: string): boolean {
    return policy === 'manual_only' || policy === 'ready_then_manual';
  }

  async assertQueueAllowsManualPrioritize(orgId: string, queueId: string): Promise<void> {
    const policy =
      (await this.batchResolveCallingPolicies(orgId, [queueId])).get(queueId) ?? 'fifo';
    if (!this.isManualCallingPolicy(policy)) {
      throw new BadRequestException(
        'Bring to first is only allowed for queues that use a manual calling policy.',
      );
    }
    const stepRole = await this.resolveQueueStepRole(orgId, queueId);
    if (stepRole === 'pickup') {
      throw new BadRequestException(
        'Bring to front is not used on pickup steps — call any ready customer directly.',
      );
    }
  }

  async batchResolveCallingPolicies(
    orgId: string,
    queueIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!queueIds.length) return map;

    const queues = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.findMany({
        where: { orgId, id: { in: queueIds } },
        select: { id: true, callingPolicy: true, stepRole: true, flowTemplateId: true },
      }),
    );

    const templateIds = [
      ...new Set(queues.map((q) => q.flowTemplateId).filter(Boolean)),
    ] as string[];
    const flowSteps =
      templateIds.length > 0
        ? await this.prisma.withTenant(orgId, (tx) =>
            tx.branchFlowStep.findMany({
              where: { orgId, templateId: { in: templateIds }, queueId: { in: queueIds } },
              select: { queueId: true, stepRole: true, callingPolicy: true, templateId: true },
            }),
          )
        : [];

    for (const queue of queues) {
      const step = flowSteps.find(
        (s) => s.queueId === queue.id && s.templateId === queue.flowTemplateId,
      );
      if (step) {
        map.set(queue.id, resolveCallingPolicyForStep(step.stepRole, step.callingPolicy));
      } else {
        map.set(queue.id, resolveCallingPolicyForStep(queue.stepRole, queue.callingPolicy));
      }
    }
    return map;
  }

  private async resolveQueueStepRole(orgId: string, queueId: string): Promise<string | null> {
    const queue = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.findFirst({
        where: { id: queueId, orgId },
        select: { stepRole: true, flowTemplateId: true },
      }),
    );
    if (!queue) return null;
    if (queue.flowTemplateId) {
      const templateId = queue.flowTemplateId;
      const step = await this.prisma.withTenant(orgId, (tx) =>
        tx.branchFlowStep.findFirst({
          where: { orgId, templateId, queueId },
          select: { stepRole: true },
        }),
      );
      if (step?.stepRole) return step.stepRole;
    }
    return queue.stepRole;
  }
}
