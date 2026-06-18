import { BadRequestException, Injectable } from '@nestjs/common';
import { isReadyGatedCallingPolicy, journeyProfileSupportsMarkReady } from '@queueplatform/shared';
import { userCanUseFifoManualCall } from '../../common/rbac/org-owner.util';
import { orgLocalStartOfDayMinusDaysUtc } from '../../common/org-local-dates';
import { resolveBranchIanaZone } from '../../common/resolve-effective-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { WorkbenchLane, WorkbenchResponse } from './workbench.types';
import { WORKBENCH_ACTIVE_STATUSES, WORKBENCH_ITEM_LIMIT_PER_LANE } from './workbench.constants';
import { normalizeWorkbenchDeskNumber } from './workbench-desk.util';
import { parseWorkbenchCapabilities } from './workbench-station-capability.util';
import { resolveWorkbenchVisitExternalRefs } from './workbench-visit-ref.util';
import { WorkbenchQueuePolicyService } from './workbench-queue-policy.service';
import { WorkbenchWorkItemService } from './workbench-work-item.service';
import { StationProfileService } from './station-profile.service';
import { AgentSessionService } from './agent-session.service';
import { TicketService } from '../ticket/ticket.service';

@Injectable()
export class WorkbenchBoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly stationProfileService: StationProfileService,
    private readonly agentSessionService: AgentSessionService,
    private readonly queuePolicy: WorkbenchQueuePolicyService,
    private readonly workItems: WorkbenchWorkItemService,
    private readonly ticketService?: TicketService,
  ) {}

  async getWorkbench(
    orgId: string,
    userId: string,
    params: {
      branchId: string;
      stationProfileId?: string;
      deskId?: string;
      deskNumber?: string;
      period?: 'today' | 'week';
      /** When true, prefer Combined counter profile so all journey steps are actionable. */
      forJourney?: boolean;
      queueId?: string;
    },
  ): Promise<WorkbenchResponse> {
    let stationProfileId = params.stationProfileId;
    if (!stationProfileId && params.forJourney && params.deskNumber?.trim()) {
      const deskNumber = normalizeWorkbenchDeskNumber(params.deskNumber);
      const desk = await this.prisma.withTenant(orgId, (tx) =>
        tx.desk.findFirst({
          where: { orgId, branchId: params.branchId, number: deskNumber },
          select: { defaultStationProfileId: true },
        }),
      );
      stationProfileId = desk?.defaultStationProfileId ?? undefined;
    }
    if (!stationProfileId) {
      stationProfileId = params.forJourney
        ? await this.stationProfileService.resolveJourneyProfileForBranch(
            orgId,
            userId,
            params.branchId,
            params.deskNumber,
            params.queueId,
          )
        : await this.stationProfileService.resolveDefaultProfileForBranch(
            orgId,
            userId,
            params.branchId,
            params.deskNumber,
          );
    }
    const [profileInitial, branchTz] = await Promise.all([
      this.stationProfileService.getById(orgId, userId, stationProfileId),
      resolveBranchIanaZone(this.prisma, orgId, params.branchId, this.redis),
    ]);
    let profile = profileInitial;
    const warnings: Array<{ code: string; message: string }> = [];
    if (profile.branchId !== params.branchId) {
      throw new BadRequestException('Station profile does not belong to this branch');
    }

    if (params.forJourney) {
      const flowTemplateIdForRepair =
        profile.flowTemplateId ??
        (await this.stationProfileService.resolveActiveFlowTemplateId(
          orgId,
          params.branchId,
          params.deskNumber,
        ));
      if (flowTemplateIdForRepair) {
        const repairCacheKey = `cache:journey-profile-repair:${orgId}:${stationProfileId}:${flowTemplateIdForRepair}`;
        const recentlyChecked = await this.redis.get(repairCacheKey);
        if (!recentlyChecked) {
          // Keep the desk profile in sync with the flow's step queues so an advanced
          // ticket can never land in a queue that the board does not render. Flow-step
          // queue-link repair is intentionally NOT run here: it is a heavy multi-query
          // pass and the complete action self-repairs the specific next step it needs.
          const repaired = await this.stationProfileService.repairJourneyProfileQueues(
            orgId,
            stationProfileId,
            flowTemplateIdForRepair,
          );
          await this.redis.set(repairCacheKey, '1', 300);
          if (repaired) {
            profile = await this.stationProfileService.getById(orgId, userId, stationProfileId);
          }
        }
      }

      const pickupLaneBroken = profile.queues.some(
        (q) =>
          q.queue.stepRole === 'pickup' &&
          isReadyGatedCallingPolicy(q.queue.callingPolicy) &&
          !journeyProfileSupportsMarkReady(q.visibilityOnly, q.capabilities),
      );
      if (pickupLaneBroken) {
        await this.stationProfileService.provisionJourneyStationProfiles(
          orgId,
          userId,
          params.branchId,
          params.deskNumber,
        );
        warnings.push({
          code: 'JOURNEY_PROFILE_DRIFT_REPAIRED',
          message:
            'Journey desk profile was out of sync and has been auto-repaired for pickup readiness actions.',
        });
        stationProfileId = await this.stationProfileService.resolveJourneyProfileForBranch(
          orgId,
          userId,
          params.branchId,
          params.deskNumber,
        );
        profile = await this.stationProfileService.getById(orgId, userId, stationProfileId);
        const stillBroken = profile.queues.some(
          (q) =>
            q.queue.stepRole === 'pickup' &&
            isReadyGatedCallingPolicy(q.queue.callingPolicy) &&
            !journeyProfileSupportsMarkReady(q.visibilityOnly, q.capabilities),
        );
        if (stillBroken) {
          warnings.push({
            code: 'JOURNEY_PROFILE_DRIFT_BLOCKING',
            message:
              'Pickup readiness actions are still blocked after repair. Re-generate station profiles for this flow.',
          });
        }
      }
    }

    const surface = params.forJourney ? 'journey' : 'classic';
    const deskNumber =
      params.deskNumber != null && String(params.deskNumber).trim() !== ''
        ? normalizeWorkbenchDeskNumber(params.deskNumber)
        : undefined;
    const session = await this.agentSessionService.syncSessionForWorkbench(orgId, userId, {
      branchId: params.branchId,
      stationProfileId,
      surface,
      deskId: params.deskId,
      deskNumber,
    });

    const period = params.period ?? 'today';
    const lookbackStart =
      period === 'week'
        ? orgLocalStartOfDayMinusDaysUtc(branchTz, 6)
        : orgLocalStartOfDayMinusDaysUtc(branchTz, 0);

    const queueConfigs = profile.queues;
    const queueIds = queueConfigs.map((q) => q.queueId);
    const policyByQueue = await this.queuePolicy.batchResolveCallingPolicies(orgId, queueIds);

    const [tickets, visitExternalRefByVisitId] = await this.prisma.withTenant(orgId, async (tx) => {
      const tkts = await tx.ticket.findMany({
        where: {
          orgId,
          queueId: { in: queueIds },
          bookedAt: { gte: lookbackStart },
          status: { in: [...WORKBENCH_ACTIVE_STATUSES] },
        },
        include: {
          queue: { select: { id: true, name: true, stepRole: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: [{ priority: 'desc' }, { bookedAt: 'asc' }],
        take: queueIds.length * WORKBENCH_ITEM_LIMIT_PER_LANE,
      });

      const refs = await resolveWorkbenchVisitExternalRefs(
        orgId,
        tkts.map((t) => t.visitId).filter((id): id is string => !!id),
        tx,
      );
      return [tkts, refs] as const;
    });

    const allowReprioritize = params.forJourney
      ? await userCanUseFifoManualCall(this.prisma, orgId, userId, params.branchId)
      : false;

    const activeDeskNumber = deskNumber ?? session.deskNumber ?? null;
    const activeTicket =
      activeDeskNumber != null
        ? (tickets.find(
            (t) =>
              (t.status === 'called' || t.status === 'serving') &&
              String(t.deskNumber ?? '') === String(activeDeskNumber),
          ) ?? null)
        : (tickets.find((t) => t.status === 'called' || t.status === 'serving') ?? null);

    const lanes: WorkbenchLane[] = queueConfigs.map((config) => {
      const queueTickets = tickets.filter((t) => t.queueId === config.queueId);
      const callingPolicy = policyByQueue.get(config.queueId) ?? 'fifo';
      const capabilities = parseWorkbenchCapabilities(config.capabilities);
      const visibilityOnly = config.visibilityOnly;
      const isPrimary = profile.primaryQueueId === config.queueId;

      const awaitingReady = queueTickets.filter(
        (t) => t.status === 'waiting' && !t.readyAt && this.queuePolicy.isReadyGated(callingPolicy),
      ).length;

      const items = queueTickets
        .map((t) =>
          this.workItems.toWorkItem(
            t,
            config.queue,
            capabilities,
            visibilityOnly,
            callingPolicy,
            policyByQueue,
            visitExternalRefByVisitId,
            allowReprioritize,
          ),
        )
        .slice(0, WORKBENCH_ITEM_LIMIT_PER_LANE);

      const suggestedNext = this.workItems.pickSuggestedNext(items, callingPolicy);

      return {
        queueId: config.queueId,
        queueName: config.queue.name,
        stepRole: config.queue.stepRole,
        callingPolicy,
        isPrimary,
        visibilityOnly,
        capabilities,
        counts: {
          waiting: queueTickets.filter((t) => t.status === 'waiting').length,
          called: queueTickets.filter((t) => t.status === 'called').length,
          serving: queueTickets.filter((t) => t.status === 'serving').length,
          awaitingReady,
        },
        suggestedNext,
        items,
      };
    });

    const visits = this.workItems.buildVisitGroups(tickets, queueConfigs, policyByQueue);

    return {
      generatedAt: new Date().toISOString(),
      ...(warnings.length ? { warnings } : {}),
      session: {
        id: session.id,
        branchId: params.branchId,
        deskId: session.deskId,
        deskNumber: session.deskNumber,
        stationProfileId: profile.id,
        stationProfileName: profile.name,
        subscribedQueueIds: queueIds,
      },
      profile: {
        id: profile.id,
        name: profile.name,
        primaryQueueId: profile.primaryQueueId,
        flowTemplateId: profile.flowTemplateId,
      },
      lanes,
      visits,
      activeTicket: activeTicket as Record<string, unknown> | null,
    };
  }
}
