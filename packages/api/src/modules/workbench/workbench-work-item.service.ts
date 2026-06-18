import { Injectable } from '@nestjs/common';
import {
  journeyStepAcceptsExternalRef,
  STATION_CAPABILITIES,
  type StationCapability,
} from '@queueplatform/shared';
import { userCanUseFifoManualCall } from '../../common/rbac/org-owner.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { WorkbenchVisit, WorkbenchWorkItem, WorkItemAction } from './workbench.types';
import { parseWorkbenchCapabilities } from './workbench-station-capability.util';
import { WorkbenchQueuePolicyService } from './workbench-queue-policy.service';
import { resolveWorkbenchVisitExternalRefs } from './workbench-visit-ref.util';
import { StationProfileService } from './station-profile.service';

@Injectable()
export class WorkbenchWorkItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queuePolicy: WorkbenchQueuePolicyService,
    private readonly stationProfileService: StationProfileService,
  ) {}

  async buildWorkbenchWorkItemForTicket(
    orgId: string,
    userId: string,
    stationProfileId: string,
    ticketId: string,
  ): Promise<WorkbenchWorkItem | null> {
    const ticket = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.ticket.findFirst({
        where: { id: ticketId, orgId },
        include: {
          queue: { select: { id: true, name: true, stepRole: true } },
        },
      });
    });
    if (!ticket) return null;
    return this.buildWorkbenchWorkItemFromIssued(orgId, userId, stationProfileId, ticket);
  }

  async buildWorkbenchWorkItemFromIssued(
    orgId: string,
    userId: string,
    stationProfileId: string,
    ticket: {
      id: string;
      visitId: string | null;
      displayNumber: string;
      queueId: string;
      status: string;
      readyAt: Date | null;
      customerName: string | null;
      customerPhone: string | null;
      deskNumber: string | null;
      bookedAt: Date;
      priority: number;
      stepIndex: number | null;
      externalRef: string | null;
      queue?: { id: string; name: string; stepRole?: string | null } | null;
    },
  ): Promise<WorkbenchWorkItem | null> {
    let profile = await this.stationProfileService.getById(orgId, userId, stationProfileId);
    let config = profile.queues.find((q) => q.queueId === ticket.queueId);
    if (!config) {
      const flowTemplateId =
        profile.flowTemplateId ??
        (await this.stationProfileService.resolveActiveFlowTemplateId(orgId, profile.branchId));
      if (flowTemplateId) {
        const repaired = await this.stationProfileService.repairJourneyProfileQueues(
          orgId,
          stationProfileId,
          flowTemplateId,
        );
        if (repaired) {
          profile = await this.stationProfileService.getById(orgId, userId, stationProfileId);
          config = profile.queues.find((q) => q.queueId === ticket.queueId);
        }
      }
    }
    if (!config) return null;

    const [policyByQueue, visitExternalRefByVisitId] = await this.prisma.withTenant(
      orgId,
      async (tx) => {
        const policies = await this.queuePolicy.batchResolveCallingPolicies(orgId, [
          ticket.queueId,
        ]);
        const refs = await resolveWorkbenchVisitExternalRefs(
          orgId,
          ticket.visitId ? [ticket.visitId] : [],
          tx,
        );
        return [policies, refs] as const;
      },
    );

    const queueMeta = {
      id: config.queue.id,
      name: config.queue.name,
      stepRole: config.queue.stepRole ?? null,
    };

    const allowReprioritize = await userCanUseFifoManualCall(
      this.prisma,
      orgId,
      userId,
      profile.branchId,
    );

    return this.toWorkItem(
      {
        ...ticket,
        queue: ticket.queue
          ? {
              id: ticket.queue.id,
              name: ticket.queue.name,
              stepRole: ticket.queue.stepRole ?? null,
            }
          : queueMeta,
      },
      config.queue,
      parseWorkbenchCapabilities(config.capabilities),
      config.visibilityOnly,
      policyByQueue.get(ticket.queueId) ?? 'fifo',
      policyByQueue,
      visitExternalRefByVisitId,
      allowReprioritize,
    );
  }

  toWorkItem(
    ticket: {
      id: string;
      visitId: string | null;
      displayNumber: string;
      queueId: string;
      status: string;
      readyAt: Date | null;
      customerName: string | null;
      customerPhone: string | null;
      deskNumber: string | null;
      bookedAt: Date;
      priority: number;
      stepIndex: number | null;
      externalRef: string | null;
      queue: { id: string; name: string; stepRole: string | null };
    },
    queueMeta: { name: string; stepRole: string | null },
    capabilities: StationCapability[],
    visibilityOnly: boolean,
    callingPolicy: string,
    _policyByQueue: Map<string, string>,
    visitExternalRefByVisitId: Map<string, string> = new Map(),
    allowReprioritize = false,
  ): WorkbenchWorkItem {
    const allowedActions = visibilityOnly
      ? []
      : this.deriveAllowedActions(
          ticket,
          capabilities,
          callingPolicy,
          queueMeta.stepRole,
          allowReprioritize,
        );

    const waitMins = Math.max(0, Math.floor((Date.now() - ticket.bookedAt.getTime()) / 60000));
    let urgency = waitMins;
    if (
      ticket.status === 'waiting' &&
      this.queuePolicy.isReadyGated(callingPolicy) &&
      !ticket.readyAt
    ) {
      urgency += 1000;
    }
    if (ticket.status === 'called') urgency += 500;

    return {
      id: ticket.id,
      visitId: ticket.visitId,
      displayNumber: ticket.displayNumber,
      queueId: ticket.queueId,
      queueName: queueMeta.name,
      stepRole: queueMeta.stepRole,
      status: ticket.status,
      readyAt: ticket.readyAt?.toISOString() ?? null,
      customerName: ticket.customerName,
      customerPhone: ticket.customerPhone,
      deskNumber: ticket.deskNumber,
      bookedAt: ticket.bookedAt.toISOString(),
      priority: ticket.priority,
      urgency,
      externalRef: journeyStepAcceptsExternalRef(ticket.stepIndex, queueMeta.stepRole)
        ? ticket.externalRef?.trim() ||
          (ticket.visitId ? (visitExternalRefByVisitId.get(ticket.visitId) ?? null) : null)
        : null,
      allowedActions,
      visibilityOnly,
    };
  }

  deriveAllowedActions(
    ticket: { status: string; readyAt: Date | null },
    capabilities: StationCapability[],
    callingPolicy: string,
    stepRole?: string | null,
    allowReprioritize = false,
  ): WorkItemAction[] {
    const actions: WorkItemAction[] = [];
    const has = (c: StationCapability) => capabilities.includes(c);

    if (ticket.status === 'waiting') {
      if (has(STATION_CAPABILITIES.CALL)) {
        if (
          this.queuePolicy.isManualCallingPolicy(callingPolicy) &&
          (!this.queuePolicy.isReadyGated(callingPolicy) || ticket.readyAt)
        ) {
          actions.push('call_specific');
        }
        if (
          allowReprioritize &&
          !this.queuePolicy.isManualCallingPolicy(callingPolicy) &&
          stepRole !== 'pickup'
        ) {
          actions.push('prioritize');
        }
      }
      if (
        has(STATION_CAPABILITIES.MARK_READY) &&
        this.queuePolicy.isReadyGated(callingPolicy) &&
        !ticket.readyAt
      ) {
        actions.push('mark_ready');
      }
      if (has(STATION_CAPABILITIES.CANCEL)) actions.push('cancel');
    }
    if (ticket.status === 'called') {
      if (has(STATION_CAPABILITIES.SERVE)) actions.push('serve');
      if (has(STATION_CAPABILITIES.NO_SHOW)) actions.push('no_show');
    }
    if (ticket.status === 'serving') {
      if (has(STATION_CAPABILITIES.COMPLETE)) actions.push('complete');
      if (has(STATION_CAPABILITIES.NO_SHOW)) actions.push('no_show');
    }
    return actions;
  }

  pickSuggestedNext(items: WorkbenchWorkItem[], callingPolicy: string): WorkbenchWorkItem | null {
    const callable = items.filter(
      (i) =>
        i.status === 'waiting' &&
        !i.visibilityOnly &&
        (i.allowedActions.includes('call_specific') || i.allowedActions.includes('mark_ready')),
    );
    if (!callable.length) return null;

    if (this.queuePolicy.isReadyGated(callingPolicy)) {
      const ready = callable.filter((i) => i.readyAt);
      if (ready.length) {
        return ready.sort((a, b) => a.bookedAt.localeCompare(b.bookedAt))[0] ?? null;
      }
      return null;
    }

    return (
      callable.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.bookedAt.localeCompare(b.bookedAt);
      })[0] ?? null
    );
  }

  buildVisitGroups(
    tickets: Array<{
      id: string;
      visitId: string | null;
      displayNumber: string;
      customerName: string | null;
      queueId: string;
      status: string;
      readyAt: Date | null;
      stepIndex: number | null;
      queue: { id: string; name: string; stepRole: string | null };
    }>,
    queueConfigs: Array<{
      queueId: string;
      visibilityOnly: boolean;
      capabilities: unknown;
      queue: { name: string; stepRole: string | null };
    }>,
    policyByQueue: Map<string, string>,
  ): WorkbenchVisit[] {
    const byVisit = new Map<string, typeof tickets>();
    for (const t of tickets) {
      if (!t.visitId) continue;
      const list = byVisit.get(t.visitId) ?? [];
      list.push(t);
      byVisit.set(t.visitId, list);
    }

    const visits: WorkbenchVisit[] = [];
    for (const [visitId, visitTickets] of byVisit) {
      const sorted = [...visitTickets].sort((a, b) => (a.stepIndex ?? 0) - (b.stepIndex ?? 0));
      const configByQueue = new Map(queueConfigs.map((c) => [c.queueId, c]));

      visits.push({
        visitId,
        displayNumber: sorted[0]?.displayNumber ?? '',
        customerName: sorted[0]?.customerName ?? null,
        steps: sorted.map((t) => {
          const config = configByQueue.get(t.queueId);
          const caps = config ? parseWorkbenchCapabilities(config.capabilities) : [];
          const policy = policyByQueue.get(t.queueId) ?? 'fifo';
          return {
            stepIndex: t.stepIndex,
            queueId: t.queueId,
            queueName: t.queue.name,
            ticketId: t.id,
            status: t.status,
            readyAt: t.readyAt?.toISOString() ?? null,
            allowedActions: config
              ? this.deriveAllowedActions(t, caps, policy, t.queue.stepRole)
              : [],
          };
        }),
      });
    }

    return visits.sort((a, b) => a.displayNumber.localeCompare(b.displayNumber));
  }
}
