import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentSessionService } from './agent-session.service';
import { JourneyDeskAssignmentGuard } from './journey-desk-assignment.guard';
import { StationProfileService } from './station-profile.service';

@Injectable()
export class WorkbenchJourneySessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stationProfileService: StationProfileService,
    private readonly agentSessionService: AgentSessionService,
    private readonly journeyDeskAssignmentGuard: JourneyDeskAssignmentGuard,
  ) {}

  /**
   * Ensures journey agent session exists and desk matches before call-next / call-specific.
   * Mutations must not depend on a prior GET /workbench completing first.
   */
  async ensureJourneySessionAtDesk(
    orgId: string,
    userId: string,
    input: { stationProfileId: string; branchId: string; deskNumber: string },
  ) {
    const deskNumber = await this.journeyDeskAssignmentGuard.assertMayUseJourneyDesk(
      orgId,
      userId,
      input.branchId,
      input.deskNumber,
    );
    return this.agentSessionService.syncSessionForWorkbench(orgId, userId, {
      branchId: input.branchId,
      stationProfileId: input.stationProfileId,
      surface: 'journey',
      deskNumber,
    });
  }

  /**
   * Require an already-established journey session with a signed-in desk.
   * Complete/no-show style actions should fail fast when no counter session exists.
   */
  async assertJourneyQueueDeskAssignment(
    orgId: string,
    userId: string,
    branchId: string,
    queueId: string,
    deskNumber: string,
  ): Promise<void> {
    await this.journeyDeskAssignmentGuard.assertMayActOnJourneyQueue(
      orgId,
      userId,
      branchId,
      queueId,
      deskNumber,
    );
  }

  /**
   * Counter number used for call/SMS on a journey queue (step position wins over UI session desk).
   */
  async resolveDeskForJourneyQueueCall(
    orgId: string,
    userId: string,
    branchId: string,
    queueId: string,
    requestedDeskNumber: string,
  ): Promise<string> {
    return this.journeyDeskAssignmentGuard.resolveDeskForJourneyQueue(
      orgId,
      userId,
      branchId,
      queueId,
      requestedDeskNumber,
    );
  }

  async requireActiveJourneyDeskSession(
    orgId: string,
    userId: string,
    input: { stationProfileId: string; branchId: string; actionLabel: string },
  ): Promise<{ deskNumber: string }> {
    const session = await this.agentSessionService.getActive(orgId, userId, 'journey');
    if (
      !session ||
      session.branchId !== input.branchId ||
      session.stationProfileId !== input.stationProfileId ||
      !session.deskNumber
    ) {
      throw new BadRequestException(
        `${input.actionLabel}: Sign in at a desk on the multi-step page first (workbench session required).`,
      );
    }
    return { deskNumber: session.deskNumber };
  }

  /**
   * Lightweight session establishment for multi-step UI (station commit / preflight).
   */
  async establishJourneySession(
    orgId: string,
    userId: string,
    params: { branchId: string; deskNumber: string; stationProfileId?: string },
  ) {
    const deskNumber = await this.journeyDeskAssignmentGuard.assertMayUseJourneyDesk(
      orgId,
      userId,
      params.branchId,
      params.deskNumber,
    );
    const branch = await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.findFirst({
        where: { id: params.branchId, orgId },
        select: { id: true },
      }),
    );
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    let stationProfileId = params.stationProfileId;
    if (!stationProfileId) {
      const desk = await this.prisma.withTenant(orgId, (tx) =>
        tx.desk.findFirst({
          where: { orgId, branchId: params.branchId, number: deskNumber },
          select: { defaultStationProfileId: true },
        }),
      );
      stationProfileId = desk?.defaultStationProfileId ?? undefined;
    }
    if (!stationProfileId) {
      stationProfileId = await this.stationProfileService.resolveJourneyProfileForBranch(
        orgId,
        userId,
        params.branchId,
        deskNumber,
      );
    }

    const session = await this.ensureJourneySessionAtDesk(orgId, userId, {
      stationProfileId,
      branchId: params.branchId,
      deskNumber,
    });
    return {
      sessionId: session.id,
      branchId: session.branchId,
      deskNumber: session.deskNumber,
      stationProfileId: session.stationProfileId,
    };
  }
}
