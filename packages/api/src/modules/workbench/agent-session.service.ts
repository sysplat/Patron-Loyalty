import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StationProfileService } from './station-profile.service';

export type StartAgentSessionInput = {
  branchId: string;
  stationProfileId: string;
  deskId?: string | null;
  deskNumber?: string | null;
  surface?: string;
};

@Injectable()
export class AgentSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stationProfileService: StationProfileService,
  ) {}

  async getActive(orgId: string, userId: string, surface: string = 'classic') {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.agentSession.findFirst({
        where: { orgId, userId, endedAt: null, surface },
        orderBy: { lastHeartbeatAt: 'desc' },
        include: {
          stationProfile: {
            include: {
              queues: {
                orderBy: { sortOrder: 'asc' },
                include: { queue: { select: { id: true, name: true } } },
              },
            },
          },
          desk: { select: { id: true, number: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
    );
  }

  private async resolveJourneyDesk(orgId: string, branchId: string, deskNumber: string) {
    const desk = await this.prisma.withTenant(orgId, (tx) =>
      tx.desk.findFirst({
        where: { orgId, branchId, number: deskNumber },
      }),
    );
    if (!desk) {
      throw new NotFoundException(
        `Desk ${deskNumber} is not configured for this branch. Add it under Branch desks in the dashboard.`,
      );
    }
    return desk;
  }

  /**
   * Ensure one active agent/session owns a desk per surface.
   * Used on both start and in-place desk switches.
   */
  private async endConflictingDeskSessions(
    orgId: string,
    userId: string,
    input: {
      branchId: string;
      surface: string;
      deskId?: string | null;
      deskNumber?: string | null;
      excludeSessionId?: string;
    },
  ) {
    const deskId = input.deskId ?? null;
    const deskNumber = input.deskNumber ?? null;
    if (!deskId && !deskNumber) return;
    await this.prisma.withTenant(orgId, (tx) =>
      tx.agentSession.updateMany({
        where: {
          orgId,
          branchId: input.branchId,
          endedAt: null,
          surface: input.surface,
          OR: [...(deskId ? [{ deskId }] : []), ...(deskNumber ? [{ deskNumber }] : [])],
          userId: { not: userId },
          ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {}),
        },
        data: { endedAt: new Date() },
      }),
    );
  }

  async start(orgId: string, userId: string, input: StartAgentSessionInput & { surface?: string }) {
    const surface = input.surface ?? 'classic';
    const profile = await this.stationProfileService.getById(orgId, userId, input.stationProfileId);
    if (profile.branchId !== input.branchId) {
      throw new BadRequestException('Station profile does not belong to this branch');
    }

    let deskId: string | null = null;
    let deskNumber: string | null = input.deskNumber ?? null;

    if (surface === 'classic' && input.deskId) {
      const requestedDeskId = input.deskId;
      const desk = await this.prisma.withTenant(orgId, (tx) =>
        tx.desk.findFirst({
          where: { id: requestedDeskId, orgId, branchId: input.branchId },
        }),
      );
      if (!desk) throw new NotFoundException('Desk not found');
      deskId = desk.id;
      deskNumber = desk.number;
    } else if (surface === 'journey' && input.deskNumber) {
      const desk = await this.resolveJourneyDesk(orgId, input.branchId, input.deskNumber);
      deskId = desk.id;
      deskNumber = desk.number;
    }

    await this.prisma.withTenant(orgId, (tx) =>
      tx.agentSession.updateMany({
        where: { orgId, userId, endedAt: null, surface },
        data: { endedAt: new Date() },
      }),
    );

    await this.endConflictingDeskSessions(orgId, userId, {
      branchId: input.branchId,
      surface,
      deskId,
      deskNumber,
    });

    return this.prisma.withTenant(orgId, (tx) =>
      tx.agentSession.create({
        data: {
          orgId,
          userId,
          branchId: input.branchId,
          deskId,
          deskNumber,
          stationProfileId: input.stationProfileId,
          surface,
          lastHeartbeatAt: new Date(),
        },
        include: {
          branch: { select: { id: true, name: true } },
          stationProfile: {
            include: {
              queues: {
                orderBy: { sortOrder: 'asc' },
                include: { queue: { select: { id: true, name: true } } },
              },
            },
          },
          desk: { select: { id: true, number: true, name: true } },
        },
      }),
    );
  }

  async heartbeat(orgId: string, userId: string, sessionId: string) {
    const session = await this.prisma.withTenant(orgId, (tx) =>
      tx.agentSession.findFirst({
        where: { id: sessionId, orgId, userId, endedAt: null },
      }),
    );
    if (!session) throw new NotFoundException('Active session not found');

    return this.prisma.withTenant(orgId, (tx) =>
      tx.agentSession.update({
        where: { id: sessionId },
        data: { lastHeartbeatAt: new Date() },
      }),
    );
  }

  async end(orgId: string, userId: string, sessionId?: string, surface?: string) {
    const where: any = { orgId, userId, endedAt: null };
    if (sessionId) where.id = sessionId;
    if (surface) where.surface = surface;

    const result = await this.prisma.withTenant(orgId, (tx) =>
      tx.agentSession.updateMany({
        where,
        data: { endedAt: new Date() },
      }),
    );
    return { ended: result.count };
  }

  /**
   * Ensures an active agent session for the workbench surface and syncs desk/station presence.
   * Used by GET /workbench and by desk-scoped actions so mutations never depend on a prior read.
   */
  async syncSessionForWorkbench(
    orgId: string,
    userId: string,
    input: {
      branchId: string;
      stationProfileId: string;
      surface: 'journey' | 'classic';
      deskId?: string | null;
      deskNumber?: string | null;
    },
  ) {
    const profile = await this.stationProfileService.getById(orgId, userId, input.stationProfileId);
    if (profile.branchId !== input.branchId) {
      throw new BadRequestException('Station profile does not belong to this branch');
    }

    const surface = input.surface;
    const session = await this.getActive(orgId, userId, surface);
    if (
      !session ||
      session.stationProfileId !== input.stationProfileId ||
      session.branchId !== input.branchId
    ) {
      return this.start(orgId, userId, {
        branchId: input.branchId,
        stationProfileId: input.stationProfileId,
        deskId: input.deskId,
        deskNumber: input.deskNumber,
        surface,
      });
    }

    if (input.deskId || input.deskNumber) {
      let deskId: string | null = session.deskId ?? null;
      let deskNumber: string | null = session.deskNumber ?? null;

      if (surface === 'journey' && input.deskNumber) {
        const desk = await this.resolveJourneyDesk(orgId, input.branchId, input.deskNumber);
        deskId = desk.id;
        deskNumber = desk.number;
      } else if (surface === 'classic' && input.deskId) {
        deskId = input.deskId;
      }

      await this.endConflictingDeskSessions(orgId, userId, {
        branchId: input.branchId,
        surface,
        deskId,
        deskNumber,
        excludeSessionId: session.id,
      });

      await this.prisma.withTenant(orgId, (tx) =>
        tx.agentSession.update({
          where: { id: session.id },
          data: {
            deskId: deskId ?? session.deskId,
            deskNumber: deskNumber ?? session.deskNumber,
            lastHeartbeatAt: new Date(),
          },
        }),
      );
      const refreshed = await this.getActive(orgId, userId, surface);
      if (!refreshed) {
        throw new BadRequestException('Could not establish agent session');
      }
      return refreshed;
    }

    await this.heartbeat(orgId, userId, session.id);
    return session;
  }
}
