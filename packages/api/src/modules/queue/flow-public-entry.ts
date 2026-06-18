import { BadRequestException } from '@nestjs/common';

export type FlowStepRef = {
  templateId: string;
  queueId: string | null;
  stepIndex: number;
  queue?: { name: string } | null;
  service?: { name: string } | null;
};

/**
 * Queue IDs that belong to later steps of an active multi-step flow.
 * Customers must not self-join these from kiosk/public intake.
 */
export function getNonEntryQueueIdsFromFlowSteps(steps: FlowStepRef[]): Set<string> {
  if (steps.length === 0) return new Set();
  const minStepIndex = Math.min(...steps.map((s) => s.stepIndex));
  const excluded = new Set<string>();
  for (const step of steps) {
    if (step.queueId && step.stepIndex > minStepIndex) {
      excluded.add(step.queueId);
    }
  }
  return excluded;
}

type FlowStepDbClient = {
  branchFlowTemplate: {
    findFirst: (args: {
      where: { orgId: string; branchId: string; isActive: boolean };
      select: {
        steps: {
          select: {
            templateId: true;
            queueId: true;
            stepIndex: true;
            queue: { select: { name: true } };
            service: { select: { name: true } };
          };
        };
      };
    }) => Promise<{ steps: FlowStepRef[] } | null>;
    findMany: (args: {
      where: { orgId: string; branchId: string; isActive: boolean };
      select: {
        steps: {
          select: {
            templateId: true;
            queueId: true;
            stepIndex: true;
            queue: { select: { name: true } };
            service: { select: { name: true } };
          };
        };
      };
    }) => Promise<{ steps: FlowStepRef[] }[]>;
  };
  queue?: {
    findFirst: (args: {
      where: { id: string; orgId: string };
      select: { stepRole: true };
    }) => Promise<{ stepRole: string | null } | null>;
  };
  branchFlowStep?: {
    findMany: (args: {
      where: { orgId: string; template: { branchId: string } };
      select: { queueId: true };
    }) => Promise<{ queueId: string | null }[]>;
  };
};

export async function loadActiveFlowStepsForBranch(
  db: FlowStepDbClient,
  orgId: string,
  branchId: string,
): Promise<FlowStepRef[]> {
  // Load steps from ALL active templates on this branch so the kiosk correctly
  // shows entry queues from every active template and hides later-step queues.
  const templates = await db.branchFlowTemplate.findMany({
    where: { orgId, branchId, isActive: true },
    select: {
      steps: {
        select: {
          templateId: true,
          queueId: true,
          stepIndex: true,
          queue: { select: { name: true } },
          service: { select: { name: true } },
        },
      },
    },
  });
  return templates.flatMap((t) => t.steps);
}

export async function getNonEntryQueueIdsForBranch(
  db: FlowStepDbClient,
  orgId: string,
  branchId: string,
): Promise<Set<string>> {
  const steps = await loadActiveFlowStepsForBranch(db, orgId, branchId);
  return getNonEntryQueueIdsFromFlowSteps(steps);
}

export async function getAllFlowBoundQueueIds(
  db: FlowStepDbClient,
  orgId: string,
  branchId: string,
): Promise<Set<string>> {
  if (!db.branchFlowStep) return new Set();
  const steps = await db.branchFlowStep.findMany({
    where: { orgId, template: { branchId } },
    select: { queueId: true },
  });
  return new Set(steps.map((s) => s.queueId).filter((id): id is string => Boolean(id)));
}

type PublicKioskQueue = { id: string; service: { id: string } };

/**
 * Kiosk lists open queues but labels them by service name — filter so customers see:
 * - Flow entry step queue(s) only (not Lab/Pharmacy later steps)
 * - Standalone walk-in queues for other services (e.g. Pharmacy Window)
 * - Not a second queue for the same service as the journey entry (e.g. Main Lounge + Reception both "General Consultation")
 */
export function filterPublicKioskQueues<T extends PublicKioskQueue>(
  queues: T[],
  steps: FlowStepRef[],
  allFlowBoundQueueIds: Set<string> = new Set(),
): T[] {
  const flowQueueIds = new Set(
    steps.length >= 2 ? steps.map((s) => s.queueId).filter((id): id is string => Boolean(id)) : [],
  );
  const nonEntry = getNonEntryQueueIdsFromFlowSteps(steps.length >= 2 ? steps : []);

  const entryInFlow = queues.filter((q) => flowQueueIds.has(q.id) && !nonEntry.has(q.id));
  const entryServiceIds = new Set(entryInFlow.map((q) => q.service.id));

  const standalone = queues.filter(
    (q) =>
      !flowQueueIds.has(q.id) &&
      !entryServiceIds.has(q.service.id) &&
      !allFlowBoundQueueIds.has(q.id),
  );

  return [...entryInFlow, ...standalone];
}

export async function assertPublicQueueEntryAllowed(
  db: FlowStepDbClient,
  orgId: string,
  branchId: string,
  queueId: string,
): Promise<void> {
  if (db.queue) {
    const queue = await db.queue.findFirst({
      where: { id: queueId, orgId },
      select: { stepRole: true },
    });
    if (queue?.stepRole === 'pickup') {
      throw new BadRequestException(
        'This queue is not available for walk-in check-in. Customers must start at the first step of the visit journey.',
      );
    }
  }

  const excluded = await getNonEntryQueueIdsForBranch(db, orgId, branchId);
  if (excluded.has(queueId)) {
    throw new BadRequestException(
      'This queue is not available for walk-in check-in. Customers must start at the first step of the visit journey.',
    );
  }
}

type ServiceBranchPivot = { branchId: string; isActive: boolean };

export type ServiceBranchRef = {
  id: string;
  name?: string;
  branchServices?: ServiceBranchPivot[];
};

/** Services bookable at a branch: explicitly assigned, or org-wide (no branch pivots). */
export function isServiceAvailableAtBranch(service: ServiceBranchRef, branchId: string): boolean {
  const pivots = service.branchServices ?? [];
  if (pivots.length === 0) return true;
  return pivots.some((bs) => bs.branchId === branchId && bs.isActive !== false);
}

export async function assertServicesAssignedToBranch(
  tx: {
    service: {
      findMany: (args: {
        where: { orgId: string; id: { in: string[] } };
        select: {
          id: true;
          name: true;
          branchServices: { select: { branchId: true; isActive: true } };
        };
      }) => Promise<ServiceBranchRef[]>;
    };
  },
  orgId: string,
  branchId: string,
  serviceIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(serviceIds)];
  if (uniqueIds.length === 0) return;

  const services = await tx.service.findMany({
    where: { orgId, id: { in: uniqueIds } },
    select: {
      id: true,
      name: true,
      branchServices: { select: { branchId: true, isActive: true } },
    },
  });

  if (services.length !== uniqueIds.length) {
    throw new BadRequestException('One or more services were not found');
  }

  for (const service of services) {
    if (!isServiceAvailableAtBranch(service, branchId)) {
      const label = service.name ? `"${service.name}"` : 'A selected service';
      throw new BadRequestException(`${label} is not assigned to this branch`);
    }
  }
}
