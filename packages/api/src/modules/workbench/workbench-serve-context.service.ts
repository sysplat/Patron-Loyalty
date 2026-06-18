import { Injectable, NotFoundException } from '@nestjs/common';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { PrismaService } from '../../prisma/prisma.service';
import type { BranchServeContext, ServeBranchOption } from './workbench.types';

@Injectable()
export class WorkbenchServeContextService {
  constructor(private readonly prisma: PrismaService) {}

  /** Branches that should use workbench (active multi-step flow with 2+ queues). */
  async branchNeedsWorkbench(orgId: string, branchId: string): Promise<boolean> {
    const ctx = await this.getBranchServeContext(orgId, branchId);
    return ctx.needsWorkbench;
  }

  /**
   * Branches the principal may access for the serve UI (RBAC-scoped).
   * `queueCount` reflects queues on the requested surface; branches with zero queues on that
   * surface are still listed so staff can pick their location and see an empty-queue state.
   * `journey` = multi-step workbench queues; `classic` = single-step agent queues.
   */
  async listServeBranchesForPrincipal(
    orgId: string,
    userId: string,
    surface: 'classic' | 'journey',
  ): Promise<ServeBranchOption[]> {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (allowed !== null && allowed.length === 0) {
      return [];
    }

    const branches = await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.findMany({
        where: {
          orgId,
          ...(allowed !== null ? { id: { in: allowed } } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    );

    const options: ServeBranchOption[] = [];
    for (const branch of branches) {
      const ctx = await this.getBranchServeContext(orgId, branch.id);
      const queueCount =
        surface === 'journey' ? ctx.multiStepQueueIds.length : ctx.singleStepQueueIds.length;
      options.push({
        id: branch.id,
        name: branch.name,
        mode: ctx.mode,
        queueCount,
        flowName: ctx.flowName,
        journeySummary: ctx.journeySummary,
      });
    }
    return options;
  }

  /** Human-readable context for the unified Serve customers UI. */
  async getBranchServeContext(
    orgId: string,
    branchId: string,
    queueId?: string,
    deskNumber?: string,
  ): Promise<BranchServeContext> {
    const branch = await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.findFirst({
        where: { id: branchId, orgId },
        select: { name: true },
      }),
    );
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    let flowTemplate: any = null;

    if (queueId) {
      const linkedQueue = await this.prisma.withTenant(orgId, (tx) =>
        tx.queue.findFirst({
          where: { id: queueId, orgId, branchId },
          select: { flowTemplateId: true },
        }),
      );
      if (linkedQueue?.flowTemplateId) {
        const linkedTemplateId = linkedQueue.flowTemplateId;
        flowTemplate = await this.prisma.withTenant(orgId, (tx) =>
          tx.branchFlowTemplate.findFirst({
            where: { id: linkedTemplateId, orgId, branchId },
            include: {
              steps: {
                where: { queueId: { not: null } },
                orderBy: { stepIndex: 'asc' },
                include: { queue: { select: { id: true, name: true } } },
              },
            },
          }),
        );
      }
    }

    if (!flowTemplate && deskNumber) {
      flowTemplate = await this.prisma.withTenant(orgId, (tx) =>
        tx.branchFlowTemplate.findFirst({
          where: {
            orgId,
            branchId,
            steps: { some: { deskNumber } },
          },
          include: {
            steps: {
              where: { queueId: { not: null } },
              orderBy: { stepIndex: 'asc' },
              include: { queue: { select: { id: true, name: true } } },
            },
          },
        }),
      );
    }

    if (!flowTemplate) {
      flowTemplate = await this.prisma.withTenant(orgId, (tx) =>
        tx.branchFlowTemplate.findFirst({
          where: { orgId, branchId, isActive: true },
          include: {
            steps: {
              where: { queueId: { not: null } },
              orderBy: { stepIndex: 'asc' },
              include: { queue: { select: { id: true, name: true } } },
            },
          },
        }),
      );
    }

    if (!flowTemplate) {
      const linkedQueue = await this.prisma.withTenant(orgId, (tx) =>
        tx.queue.findFirst({
          where: { orgId, branchId, flowTemplateId: { not: null } },
          select: { flowTemplateId: true },
        }),
      );
      if (linkedQueue?.flowTemplateId) {
        const linkedTemplateId = linkedQueue.flowTemplateId;
        flowTemplate = await this.prisma.withTenant(orgId, (tx) =>
          tx.branchFlowTemplate.findFirst({
            where: { id: linkedTemplateId, orgId, branchId },
            include: {
              steps: {
                where: { queueId: { not: null } },
                orderBy: { stepIndex: 'asc' },
                include: { queue: { select: { id: true, name: true } } },
              },
            },
          }),
        );
      }
    }

    const steps = (flowTemplate?.steps ?? [])
      .filter((s: any) => s.queueId)
      .map((s: any) => ({
        stepIndex: s.stepIndex,
        deskNumber: s.deskNumber?.trim() ? s.deskNumber : String(Math.max(1, s.stepIndex || 1)),
        queueId: s.queueId!,
        queueName: s.queue?.name ?? `Step ${s.stepIndex}`,
        stepRole: s.stepRole,
      }));

    const branchQueues =
      (await this.prisma.withTenant(orgId, (tx) =>
        tx.queue.findMany({
          where: { orgId, branchId },
          select: { id: true, journeyModeOverride: true, flowTemplateId: true },
        }),
      )) ?? [];
    const flowStepQueueIds = new Set(steps.map((s: any) => s.queueId));
    const multiStepQueueIds = branchQueues
      .filter(
        (q) =>
          flowStepQueueIds.has(q.id) ||
          q.journeyModeOverride === 'visit_multi_step' ||
          (!!flowTemplate?.id && q.flowTemplateId === flowTemplate.id),
      )
      .map((q) => q.id);
    const multiStepSet = new Set(multiStepQueueIds);
    const singleStepQueueIds = branchQueues.filter((q) => !multiStepSet.has(q.id)).map((q) => q.id);

    const needsWorkbench = steps.length >= 2;
    const journeySummary =
      steps.length >= 2
        ? steps.map((s: any) => s.queueName).join(' → ')
        : steps.length === 1
          ? steps[0].queueName
          : null;

    return {
      needsWorkbench,
      mode: needsWorkbench ? 'multi_step' : 'single_queue',
      branchName: branch.name,
      flowName: flowTemplate?.name ?? null,
      journeySummary,
      steps,
      singleStepQueueIds,
      multiStepQueueIds,
    };
  }
}
