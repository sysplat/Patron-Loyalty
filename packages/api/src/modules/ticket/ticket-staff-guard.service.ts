import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { userIsOrganizationSupervisor } from '../../common/rbac/org-owner.util';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchHoursService, type BranchOperationalGate } from '../branch/branch-hours.service';

@Injectable()
export class TicketStaffGuardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchHours: BranchHoursService,
  ) {}

  async assertStaffQueueActionAllowed(
    tx: Prisma.TransactionClient,
    orgId: string,
    queueId: string,
    branchId: string,
    actionLabel: string,
    gate: BranchOperationalGate,
    at: Date = new Date(),
  ): Promise<void> {
    const queue = await tx.queue.findUnique({
      where: { id: queueId, orgId },
      select: { id: true, status: true, branchId: true },
    });
    if (!queue) {
      throw new NotFoundException('Queue not found');
    }
    if (queue.branchId !== branchId) {
      throw new BadRequestException('Queue does not belong to the specified branch');
    }
    if (queue.status === 'closed') {
      throw new BadRequestException(`Queue is closed. Reopen the queue before ${actionLabel}.`);
    }

    if (gate === 'customer_intake') {
      await this.branchHours.assertBranchAcceptsCustomerIntake(
        orgId,
        branchId,
        actionLabel,
        at,
        tx,
      );
    }
  }

  /** @deprecated Prefer assertStaffQueueActionAllowed with an explicit operational gate. */
  async assertQueueNotClosedForStaffActions(
    tx: Prisma.TransactionClient,
    orgId: string,
    queueId: string,
    actionLabel: string,
  ): Promise<void> {
    const queue = await tx.queue.findUnique({
      where: { id: queueId, orgId },
      select: { branchId: true },
    });
    if (!queue) {
      throw new NotFoundException('Queue not found');
    }
    await this.assertStaffQueueActionAllowed(
      tx,
      orgId,
      queueId,
      queue.branchId,
      actionLabel,
      'queue_status_only',
    );
  }

  async assertClassicDeskAssignmentForBranch(
    tx: Prisma.TransactionClient,
    orgId: string,
    userId: string,
    branchId: string,
    options?: { requiredDeskNumber?: string | null },
  ): Promise<void> {
    if (await userIsOrganizationSupervisor(this.prisma, orgId, userId)) {
      return;
    }

    const assigned = await this.listAssignedDeskNumbersInBranch(tx, orgId, userId, branchId);
    if (assigned.length === 0) {
      throw new ForbiddenException(
        'You do not have any desk assignments in this branch. Ask a manager to assign at least one desk before serving customers here.',
      );
    }

    const requiredDeskNumber = options?.requiredDeskNumber?.trim();
    if (!requiredDeskNumber) {
      return;
    }

    if (!assigned.includes(requiredDeskNumber)) {
      const label =
        assigned.length === 1
          ? `Desk ${assigned[0]}`
          : assigned.map((number) => `Desk ${number}`).join(', ');
      throw new ForbiddenException(
        `You are not assigned to Desk ${requiredDeskNumber}. Your assigned desk(s): ${label}.`,
      );
    }
  }

  private async listAssignedDeskNumbersInBranch(
    tx: Prisma.TransactionClient,
    orgId: string,
    userId: string,
    branchId: string,
  ): Promise<string[]> {
    const rows = await tx.desk.findMany({
      where: {
        orgId,
        branchId,
        assignedUsers: { some: { id: userId } },
      },
      select: { number: true },
      orderBy: { number: 'asc' },
    });
    return rows.map((row) => String(row.number));
  }
}
