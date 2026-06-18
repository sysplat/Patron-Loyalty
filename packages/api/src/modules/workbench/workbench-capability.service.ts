import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StationCapability } from '@queueplatform/shared';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { PrismaService } from '../../prisma/prisma.service';
import { parseWorkbenchCapabilities } from './workbench-station-capability.util';
import { StationProfileService } from './station-profile.service';
import { userIsOrganizationSupervisor } from '../../common/rbac/org-owner.util';

@Injectable()
export class WorkbenchCapabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stationProfileService: StationProfileService,
  ) {}

  assertCapability(
    profileQueues: Array<{ queueId: string; visibilityOnly: boolean; capabilities: unknown }>,
    queueId: string,
    capability: StationCapability,
  ): void {
    const config = profileQueues.find((q) => q.queueId === queueId);
    if (!config) throw new BadRequestException('Queue not in station profile');
    if (config.visibilityOnly) {
      throw new BadRequestException('This queue is visibility-only for your station');
    }
    const caps = parseWorkbenchCapabilities(config.capabilities);
    if (!caps.includes(capability)) {
      throw new BadRequestException(`Missing capability: ${capability}`);
    }
  }

  async assertQueueCapabilityForProfile(
    orgId: string,
    userId: string,
    stationProfileId: string,
    queueId: string,
    capability: StationCapability,
  ): Promise<void> {
    if (await userIsOrganizationSupervisor(this.prisma, orgId, userId)) {
      return;
    }
    const profile = await this.stationProfileService.getById(orgId, userId, stationProfileId);
    this.assertCapability(profile.queues, queueId, capability);
  }

  async assertTicketCapabilityForProfile(
    orgId: string,
    userId: string,
    stationProfileId: string,
    ticketId: string,
    capability: StationCapability,
  ): Promise<{ queueId: string; branchId: string }> {
    const isSupervisor = await userIsOrganizationSupervisor(this.prisma, orgId, userId);

    const ticket = await this.prisma.withTenant(orgId, async (tx) => {
      const ticketRow = await tx.ticket.findFirst({
        where: { id: ticketId, orgId },
        select: { queueId: true, branchId: true },
      });
      if (!ticketRow) {
        throw new NotFoundException('Ticket not found');
      }

      if (!isSupervisor) {
        const profile = await tx.stationProfile.findFirst({
          where: { id: stationProfileId, orgId },
          include: {
            queues: {
              select: { queueId: true, visibilityOnly: true, capabilities: true },
            },
          },
        });
        if (!profile) {
          throw new NotFoundException('Station profile not found');
        }

        this.assertCapability(profile.queues, ticketRow.queueId, capability);
      }
      return ticketRow;
    });

    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (allowed !== null && !allowed.includes(ticket.branchId)) {
      throw new ForbiddenException('Branch not in your scope');
    }
    return ticket;
  }

  /** Resolves branch for a queue (workbench actions). */
  async resolveBranchIdForQueue(orgId: string, queueId: string): Promise<string> {
    const queue = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.findFirst({
        where: { id: queueId, orgId },
        select: { branchId: true },
      }),
    );
    if (!queue) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Queue not found',
      });
    }
    return queue.branchId;
  }
}
