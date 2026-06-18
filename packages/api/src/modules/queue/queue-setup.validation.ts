import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertServicesAssignedToBranch } from './flow-public-entry';

type DbClient = Prisma.TransactionClient | PrismaServiceLike;

type PrismaServiceLike = {
  queue: {
    findFirst: (args: {
      where: {
        orgId: string;
        branchId: string;
        prefix: string;
        id?: { not: string };
      };
      select: { id: true; prefix: true };
    }) => Promise<{ id: string; prefix: string } | null>;
  };
};

export async function assertQueuePrefixAvailable(
  tx: DbClient,
  orgId: string,
  branchId: string,
  prefix: string,
  excludeQueueId?: string,
): Promise<void> {
  const normalized = prefix.trim().toUpperCase();
  if (!normalized) throw new BadRequestException('Ticket prefix is required');

  const existing = await tx.queue.findFirst({
    where: {
      orgId,
      branchId,
      prefix: normalized,
      ...(excludeQueueId ? { id: { not: excludeQueueId } } : {}),
    },
    select: { id: true, prefix: true },
  });

  if (existing) {
    throw new ConflictException(
      `Ticket prefix "${normalized}" is already used by another queue in this branch`,
    );
  }
}

export async function assertServiceAssignedToBranchForQueue(
  tx: Parameters<typeof assertServicesAssignedToBranch>[0],
  orgId: string,
  branchId: string,
  serviceId: string,
): Promise<void> {
  await assertServicesAssignedToBranch(tx, orgId, branchId, [serviceId]);
}

export async function assertQueuesAvailableForFlowTemplate(
  tx: {
    queue: {
      findMany: (args: {
        where: { orgId: string; id: { in: string[] } };
        select: {
          id: true;
          name: true;
          flowTemplateId: true;
        };
      }) => Promise<Array<{ id: string; name: string; flowTemplateId: string | null }>>;
    };
  },
  orgId: string,
  queueIds: string[],
  allowedTemplateId?: string,
): Promise<void> {
  const uniqueIds = [...new Set(queueIds)];
  if (uniqueIds.length === 0) return;

  const queues = await tx.queue.findMany({
    where: { orgId, id: { in: uniqueIds } },
    select: { id: true, name: true, flowTemplateId: true },
  });

  for (const queue of queues) {
    if (queue.flowTemplateId && queue.flowTemplateId !== allowedTemplateId) {
      throw new BadRequestException(
        `Queue "${queue.name}" is already linked to another multi-step template`,
      );
    }
  }
}
