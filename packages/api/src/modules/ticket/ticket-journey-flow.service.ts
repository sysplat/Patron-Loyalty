import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';

type JourneyTicketContext = {
  visitId: string | null;
  stepIndex: number | null;
  branchId: string;
  queueId: string;
  flowTemplateId: string | null;
};

type JourneyNextStep = {
  stepIndex: number;
  serviceId: string;
  queueId: string;
  deskNumber: string | null;
  templateId: string;
};

type FlowStepQueueRow = {
  id: string;
  serviceId: string;
  branchId: string;
  status: string;
  stepRole: string | null;
};

@Injectable()
export class TicketJourneyFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
  ) {}

  async resolveFlowTemplateId(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    branchId: string,
    queueId?: string,
    ticketTemplateId?: string | null,
  ): Promise<string | null> {
    if (ticketTemplateId) return ticketTemplateId;

    // Queue-first: use the queue's stamped flowTemplateId (set during activation)
    // as the authoritative binding. This is critical when multiple disjoint
    // templates are active on the same branch — each queue knows its own template.
    if (queueId) {
      const queue = await db.queue.findUnique({
        where: { id: queueId, orgId },
        select: { flowTemplateId: true },
      });
      if (queue?.flowTemplateId) return queue.flowTemplateId;
    }

    // Fallback: branch-level lookup for branches with a single active template
    // or when there's no queue context (e.g. step-by-step builder).
    const active = await db.branchFlowTemplate.findFirst({
      where: { orgId, branchId, isActive: true },
      select: { id: true },
    });
    if (active) return active.id;

    return null;
  }

  async resolveFlowStepIndexForQueue(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    branchId: string,
    queueId: string,
    visitId?: string | null,
  ): Promise<number | null> {
    const templateId = await this.resolveFlowTemplateId(db, orgId, branchId, queueId);
    if (!templateId) return null;

    let minStepIndex = 0;
    if (visitId) {
      const maxStep = await db.ticket.aggregate({
        where: { orgId, visitId },
        _max: { stepIndex: true },
      });
      if (maxStep._max.stepIndex !== null) {
        minStepIndex = maxStep._max.stepIndex;
      }
    }

    const step = await db.branchFlowStep.findFirst({
      where: {
        orgId,
        templateId,
        queueId,
        stepIndex: { gte: minStepIndex },
      },
      orderBy: { stepIndex: 'asc' },
      select: { stepIndex: true },
    });

    if (!step && minStepIndex > 0) {
      const fallback = await db.branchFlowStep.findFirst({
        where: { orgId, templateId, queueId },
        orderBy: { stepIndex: 'asc' },
        select: { stepIndex: true },
      });
      if (fallback) return fallback.stepIndex;
    }

    const queue = await db.queue.findFirst({
      where: { id: queueId, orgId, branchId },
      select: { serviceId: true },
    });
    if (queue?.serviceId) {
      const stepByService = await db.branchFlowStep.findFirst({
        where: {
          orgId,
          templateId,
          serviceId: queue.serviceId,
          stepIndex: { gte: minStepIndex },
        },
        orderBy: { stepIndex: 'asc' },
        select: { stepIndex: true },
      });
      if (stepByService) return stepByService.stepIndex;
    }

    return step?.stepIndex ?? null;
  }

  async resolveVisitExternalRef(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    visitId: string,
    externalRef?: string | null,
  ): Promise<string | null> {
    const trimmed = externalRef?.trim() ?? null;
    if (trimmed) {
      await this.persistVisitExternalRef(db, orgId, visitId, trimmed);
      return trimmed;
    }

    const visit = await db.visit.findUnique({
      where: { id: visitId, orgId },
      select: { externalRef: true },
    });
    const visitRef = visit?.externalRef?.trim() ?? null;
    if (visitRef) return visitRef;

    const ticket = await db.ticket.findFirst({
      where: {
        orgId,
        visitId,
        externalRef: { not: null },
      },
      orderBy: { bookedAt: 'desc' },
      select: { externalRef: true },
    });
    const ticketRef = ticket?.externalRef?.trim() ?? null;
    if (ticketRef) {
      await this.persistVisitExternalRef(db, orgId, visitId, ticketRef);
    }
    return ticketRef;
  }

  async resolveNextJourneyStep(
    orgId: string,
    ticket: JourneyTicketContext,
  ): Promise<JourneyNextStep | null> {
    if (!ticket.visitId) {
      return null;
    }

    let currentStepIndex = ticket.stepIndex;
    if (currentStepIndex === null) {
      currentStepIndex = await this.resolveFlowStepIndexForQueue(
        this.prisma,
        orgId,
        ticket.branchId,
        ticket.queueId,
        ticket.visitId,
      );
    }
    if (currentStepIndex === null) {
      return null;
    }

    const templateId = await this.resolveFlowTemplateId(
      this.prisma,
      orgId,
      ticket.branchId,
      ticket.queueId,
      ticket.flowTemplateId,
    );
    if (!templateId) {
      return null;
    }

    const nextStep = await this.workflow.getNextStep(orgId, templateId, currentStepIndex);
    if (!nextStep) {
      return null;
    }

    // resolveQueueForFlowStep self-repairs the single step it resolves, so a full
    // template repair pass is unnecessary (and avoids extra round-trips on the hot path).
    const resolvedQueue = await this.prisma.withTenant(orgId, (tx) =>
      this.resolveQueueForFlowStep(tx, orgId, ticket.branchId, templateId, {
        stepIndex: nextStep.stepIndex,
        serviceId: nextStep.serviceId,
        queueId: nextStep.queueId,
      }),
    );
    if (!resolvedQueue) {
      return null;
    }

    return {
      stepIndex: nextStep.stepIndex,
      serviceId: nextStep.serviceId,
      queueId: resolvedQueue.id,
      deskNumber: nextStep.deskNumber ?? null,
      templateId,
    };
  }

  /**
   * Transaction-scoped next-step resolution. Resolves the queue on the caller's `tx` (same
   * connection / RLS context as the row lock + completion) so the value driving issuance is
   * authoritative at commit time, not a possibly-stale pre-transaction read.
   *
   * Returns `hasLaterStep` so callers can distinguish a genuinely final step (no further step
   * configured → expected terminal completion) from a non-final step whose next queue could
   * not be resolved (anomaly → must not silently dead-end the visit).
   */
  async resolveNextJourneyStepTx(
    tx: Prisma.TransactionClient,
    orgId: string,
    ticket: JourneyTicketContext,
  ): Promise<{ nextStep: JourneyNextStep | null; hasLaterStep: boolean }> {
    if (!ticket.visitId) return { nextStep: null, hasLaterStep: false };

    let currentStepIndex = ticket.stepIndex;
    if (currentStepIndex === null) {
      currentStepIndex = await this.resolveFlowStepIndexForQueue(
        tx,
        orgId,
        ticket.branchId,
        ticket.queueId,
        ticket.visitId,
      );
    }
    if (currentStepIndex === null) return { nextStep: null, hasLaterStep: false };

    const templateId = await this.resolveFlowTemplateId(
      tx,
      orgId,
      ticket.branchId,
      ticket.queueId,
      ticket.flowTemplateId,
    );
    if (!templateId) return { nextStep: null, hasLaterStep: false };

    const nextStep = await this.workflow.getNextStep(orgId, templateId, currentStepIndex);
    if (!nextStep) return { nextStep: null, hasLaterStep: false };

    // A later step is configured. Whether or not its queue resolves, this is not the final step.
    const resolvedQueue = await this.resolveQueueForFlowStep(
      tx,
      orgId,
      ticket.branchId,
      templateId,
      {
        stepIndex: nextStep.stepIndex,
        serviceId: nextStep.serviceId,
        queueId: nextStep.queueId,
      },
    );
    if (!resolvedQueue) return { nextStep: null, hasLaterStep: true };

    return {
      nextStep: {
        stepIndex: nextStep.stepIndex,
        serviceId: nextStep.serviceId,
        queueId: resolvedQueue.id,
        deskNumber: nextStep.deskNumber ?? null,
        templateId,
      },
      hasLaterStep: true,
    };
  }

  /** When a workflow next step exists but no live queue can be resolved for it. */
  async getNextStepResolutionFailure(
    orgId: string,
    ticket: JourneyTicketContext,
  ): Promise<{
    stepIndex: number;
    serviceId: string;
    queueId: string | null;
    templateId: string;
  } | null> {
    if (!ticket.visitId) {
      return null;
    }

    let currentStepIndex = ticket.stepIndex;
    if (currentStepIndex === null) {
      currentStepIndex = await this.resolveFlowStepIndexForQueue(
        this.prisma,
        orgId,
        ticket.branchId,
        ticket.queueId,
        ticket.visitId,
      );
    }
    if (currentStepIndex === null) {
      return null;
    }

    const templateId = await this.resolveFlowTemplateId(
      this.prisma,
      orgId,
      ticket.branchId,
      ticket.queueId,
    );
    if (!templateId) {
      return null;
    }

    const nextStep = await this.workflow.getNextStep(orgId, templateId, currentStepIndex);
    if (!nextStep) {
      return null;
    }

    const resolvedQueue = await this.prisma.withTenant(orgId, (tx) =>
      this.resolveQueueForFlowStep(tx, orgId, ticket.branchId, templateId, {
        stepIndex: nextStep.stepIndex,
        serviceId: nextStep.serviceId,
        queueId: nextStep.queueId,
      }),
    );
    if (resolvedQueue) {
      return null;
    }

    return {
      stepIndex: nextStep.stepIndex,
      serviceId: nextStep.serviceId,
      queueId: nextStep.queueId,
      templateId,
    };
  }

  /**
   * Resolves the queue for a flow step, repairing stale `branchFlowStep.queueId` links when
   * the step still points at a deleted queue but the service/branch queue exists.
   */
  async resolveQueueForFlowStep(
    tx: Prisma.TransactionClient,
    orgId: string,
    branchId: string,
    templateId: string,
    step: { stepIndex: number; serviceId: string; queueId: string | null },
  ): Promise<FlowStepQueueRow | null> {
    const select = {
      id: true,
      serviceId: true,
      branchId: true,
      status: true,
      stepRole: true,
    } as const;

    if (step.queueId) {
      const byId = await tx.queue.findFirst({
        where: { id: step.queueId, orgId },
        select,
      });
      if (byId) {
        return byId;
      }
    }

    if (!step.serviceId) {
      return null;
    }

    let byService = await tx.queue.findFirst({
      where: { orgId, branchId, serviceId: step.serviceId, status: 'open' },
      select,
    });
    if (!byService) {
      byService = await tx.queue.findFirst({
        where: { orgId, branchId, serviceId: step.serviceId },
        orderBy: { createdAt: 'asc' },
        select,
      });
    }
    if (!byService) {
      byService = await this.findQueueForFlowStepFallback(
        tx,
        orgId,
        branchId,
        templateId,
        step.stepIndex,
        step.serviceId,
        select,
      );
    }
    if (!byService) {
      return null;
    }

    if (step.queueId !== byService.id || step.serviceId !== byService.serviceId) {
      await tx.branchFlowStep.updateMany({
        where: { orgId, templateId, stepIndex: step.stepIndex },
        data: { queueId: byService.id, serviceId: byService.serviceId },
      });
    }

    return byService;
  }

  /** Repairs stale `branchFlowStep.queueId` rows for every step in a flow template. */
  async repairStaleFlowStepQueueLinks(
    orgId: string,
    branchId: string,
    templateId: string,
  ): Promise<{ repaired: number }> {
    return this.prisma.withTenant(orgId, async (tx) => {
      const steps = await tx.branchFlowStep.findMany({
        where: { orgId, templateId },
        orderBy: { stepIndex: 'asc' },
        select: { stepIndex: true, serviceId: true, queueId: true },
      });

      let repaired = 0;
      for (const step of steps) {
        const resolved = await this.resolveQueueForFlowStep(tx, orgId, branchId, templateId, step);
        if (resolved && step.queueId !== resolved.id) {
          repaired++;
        }
      }
      return { repaired };
    });
  }

  private async findQueueForFlowStepFallback(
    tx: Prisma.TransactionClient,
    orgId: string,
    branchId: string,
    templateId: string,
    stepIndex: number,
    serviceId: string,
    select: { id: true; serviceId: true; branchId: true; status: true; stepRole: true },
  ): Promise<FlowStepQueueRow | null> {
    const stepMeta = await tx.branchFlowStep.findFirst({
      where: { orgId, templateId, stepIndex },
      include: { service: { select: { name: true } } },
    });
    const serviceName = stepMeta?.service?.name?.trim();
    if (serviceName) {
      const byName = await tx.queue.findFirst({
        where: {
          orgId,
          branchId,
          OR: [
            { name: { equals: serviceName, mode: 'insensitive' } },
            { name: { contains: serviceName, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        select,
      });
      if (byName) return byName;
    }

    const orderedSteps = await tx.branchFlowStep.findMany({
      where: { orgId, templateId },
      orderBy: { stepIndex: 'asc' },
      select: { stepIndex: true },
    });
    const position = orderedSteps.findIndex((row) => row.stepIndex === stepIndex);
    if (position < 0) return null;

    const templateQueues = await tx.queue.findMany({
      where: { orgId, branchId, flowTemplateId: templateId },
      orderBy: { createdAt: 'asc' },
      select,
    });
    if (templateQueues[position]) {
      return templateQueues[position];
    }

    if (serviceId) {
      return tx.queue.findFirst({
        where: {
          orgId,
          branchId,
          serviceId,
          status: { not: 'closed' },
        },
        orderBy: { createdAt: 'asc' },
        select,
      });
    }

    return null;
  }

  private async persistVisitExternalRef(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    visitId: string,
    externalRef: string,
  ): Promise<void> {
    const trimmed = externalRef.trim();
    if (!trimmed) return;
    await db.visit.update({
      where: { id: visitId, orgId },
      data: { externalRef: trimmed },
    });
  }
}
