import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { userIsOrganizationSupervisor } from '../../common/rbac/org-owner.util';
import { normalizeWorkbenchDeskNumber } from './workbench-desk.util';

/** Ordered journey steps for a branch (queue order maps to desk numbers 1..N when configured). */
export type JourneyFlowStepRef = {
  stepIndex: number;
  deskNumber: string;
  queueId: string;
};

/**
 * Enforces desk assignment for multi-step workbench:
 * staff and viewer with branch desk assignments may only sign in and act at those desk numbers.
 * Supervisors (owner/admin/manager) bypass. Staff/viewer must have at least one branch desk assignment.
 */
const JOURNEY_STEPS_CACHE_TTL_SEC = 120;

@Injectable()
export class JourneyDeskAssignmentGuard {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private journeyStepsCacheKey(orgId: string, branchId: string): string {
    return `cache:journey-flow-steps:${orgId}:${branchId}`;
  }

  async getAssignedDeskNumbers(orgId: string, userId: string, branchId: string): Promise<string[]> {
    const desks = await this.prisma.withTenant(orgId, (tx) =>
      tx.desk.findMany({
        where: {
          orgId,
          branchId,
          assignedUsers: { some: { id: userId } },
        },
        select: { number: true },
        orderBy: { number: 'asc' },
      }),
    );
    return desks.map((d) => String(d.number));
  }

  async loadOrderedJourneySteps(orgId: string, branchId: string): Promise<JourneyFlowStepRef[]> {
    const cacheKey = this.journeyStepsCacheKey(orgId, branchId);
    const cached = await this.redis.getJson<JourneyFlowStepRef[]>(cacheKey);
    if (cached) return cached;

    const steps = await this.prisma.withTenant(orgId, async (tx) => {
      let flowTemplate = await tx.branchFlowTemplate.findFirst({
        where: { orgId, branchId, isActive: true },
        include: {
          steps: {
            where: { queueId: { not: null } },
            orderBy: { stepIndex: 'asc' },
            select: { stepIndex: true, deskNumber: true, queueId: true },
          },
        },
      });

      if (!flowTemplate) {
        const linkedQueue = await tx.queue.findFirst({
          where: { orgId, branchId, flowTemplateId: { not: null } },
          select: { flowTemplateId: true },
        });
        if (linkedQueue?.flowTemplateId) {
          flowTemplate = await tx.branchFlowTemplate.findFirst({
            where: { id: linkedQueue.flowTemplateId, orgId, branchId },
            include: {
              steps: {
                where: { queueId: { not: null } },
                orderBy: { stepIndex: 'asc' },
                select: { stepIndex: true, deskNumber: true, queueId: true },
              },
            },
          });
        }
      }

      return (flowTemplate?.steps ?? [])
        .filter((s): s is { stepIndex: number; deskNumber: string; queueId: string } => !!s.queueId)
        .map((s) => ({ stepIndex: s.stepIndex, deskNumber: s.deskNumber, queueId: s.queueId }));
    });

    await this.redis.setJson(cacheKey, steps, JOURNEY_STEPS_CACHE_TTL_SEC);
    return steps;
  }

  private async getBranchDeskNumbers(orgId: string, branchId: string): Promise<string[]> {
    const desks = await this.prisma.withTenant(orgId, (tx) =>
      tx.desk.findMany({
        where: { orgId, branchId },
        select: { number: true },
        orderBy: { number: 'asc' },
      }),
    );
    return desks.map((d) => String(d.number));
  }

  /**
   * Desk number for a journey queue from flow config.
   * Falls back to index-based behavior for legacy records that have no desk mapping.
   */
  counterNumberForQueue(
    steps: JourneyFlowStepRef[],
    queueId: string,
    branchDeskNumbers: string[] = [],
  ): string | null {
    const step = steps.find((s) => s.queueId === queueId);
    if (!step) return null;
    if (step.deskNumber?.trim()) return step.deskNumber.trim();

    const position = steps.findIndex((s) => s.queueId === queueId);
    const ideal = String(Math.max(1, step.stepIndex || position + 1));
    const configured = [...branchDeskNumbers].sort(
      (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
    );
    if (configured.length === 0) return ideal;

    if (configured.includes(ideal)) return ideal;

    for (const num of configured) {
      const n = Number.parseInt(num, 10);
      if (!Number.isNaN(n) && n >= 1 && steps[n - 1]?.queueId === queueId) {
        return num;
      }
    }

    if (position >= configured.length) {
      return configured[configured.length - 1] ?? ideal;
    }

    return configured[Math.min(position, configured.length - 1)] ?? ideal;
  }

  async assertMayUseJourneyDesk(
    orgId: string,
    userId: string,
    branchId: string,
    deskNumberRaw: string,
  ): Promise<string> {
    const deskNumber = normalizeWorkbenchDeskNumber(deskNumberRaw);
    if (await userIsOrganizationSupervisor(this.prisma, orgId, userId)) {
      return deskNumber;
    }

    const assigned = await this.getAssignedDeskNumbers(orgId, userId, branchId);
    if (assigned.length === 0) {
      throw new ForbiddenException(
        'You do not have any desk assignments in this branch. Ask a manager to assign at least one desk before serving customers here.',
      );
    }

    if (!assigned.includes(deskNumber)) {
      const label =
        assigned.length === 1 ? `Desk ${assigned[0]}` : assigned.map((n) => `Desk ${n}`).join(', ');
      throw new ForbiddenException(
        `You are not assigned to Desk ${deskNumber}. Your assigned desk(s): ${label}.`,
      );
    }

    return deskNumber;
  }

  async assertMayActOnJourneyQueue(
    orgId: string,
    userId: string,
    branchId: string,
    queueId: string,
    deskNumberRaw: string,
  ): Promise<void> {
    const deskNumber = await this.assertMayUseJourneyDesk(orgId, userId, branchId, deskNumberRaw);

    if (await userIsOrganizationSupervisor(this.prisma, orgId, userId)) {
      return;
    }

    const assigned = await this.getAssignedDeskNumbers(orgId, userId, branchId);
    if (assigned.length === 0) {
      throw new ForbiddenException(
        'You do not have any desk assignments in this branch. Ask a manager to assign at least one desk before serving customers here.',
      );
    }

    const steps = await this.loadOrderedJourneySteps(orgId, branchId);
    const branchDesks = await this.getBranchDeskNumbers(orgId, branchId);
    const requiredDesk = this.counterNumberForQueue(steps, queueId, branchDesks);
    if (!requiredDesk) {
      throw new ForbiddenException(
        'This queue is not part of the multi-step journey at this branch.',
      );
    }

    if (deskNumber !== requiredDesk) {
      throw new ForbiddenException(
        `Desk ${deskNumber} cannot perform actions on this step. Use Desk ${requiredDesk} for this step.`,
      );
    }

    if (!assigned.includes(deskNumber)) {
      const label =
        assigned.length === 1 ? `Desk ${assigned[0]}` : assigned.map((n) => `Desk ${n}`).join(', ');
      throw new ForbiddenException(
        `You are not assigned to Desk ${deskNumber}. Your assigned desk(s): ${label}.`,
      );
    }
  }

  /** Resolve the desk number used when calling/serving on a journey queue. */
  async resolveDeskForJourneyQueue(
    orgId: string,
    userId: string,
    branchId: string,
    queueId: string,
    requestedDeskRaw: string,
  ): Promise<string> {
    const requested = await this.assertMayUseJourneyDesk(orgId, userId, branchId, requestedDeskRaw);
    const steps = await this.loadOrderedJourneySteps(orgId, branchId);
    const branchDesks = await this.getBranchDeskNumbers(orgId, branchId);
    const forQueue = this.counterNumberForQueue(steps, queueId, branchDesks);
    const effective = forQueue ?? requested;
    if (await userIsOrganizationSupervisor(this.prisma, orgId, userId)) {
      return effective;
    }
    await this.assertMayActOnJourneyQueue(orgId, userId, branchId, queueId, effective);
    return effective;
  }

  async assertTicketActionOnAssignedDesk(
    orgId: string,
    userId: string,
    branchId: string,
    queueId: string,
    sessionDeskNumber: string,
  ): Promise<void> {
    await this.assertMayActOnJourneyQueue(orgId, userId, branchId, queueId, sessionDeskNumber);
  }
}
