import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  QUEUE_CALLING_POLICIES,
  QUEUE_STEP_ROLES,
  resolveCallingPolicyForStep,
  SYSTEM_ROLES,
  canStopQueue,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueUpdateDto } from './dto/queue-update.dto';
import { RedisService } from '../../redis/redis.service';
import { PlanLimitService } from '../billing/plan-limit.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { RealtimeService } from '../realtime/realtime.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import {
  filterPublicKioskQueues,
  getNonEntryQueueIdsFromFlowSteps,
  loadActiveFlowStepsForBranch,
  getAllFlowBoundQueueIds,
  assertServicesAssignedToBranch,
} from './flow-public-entry';
import {
  assertQueuePrefixAvailable,
  assertServiceAssignedToBranchForQueue,
} from './queue-setup.validation';
import {
  resolveEffectiveIanaZone,
  resolveBranchIanaZone,
} from '../../common/resolve-effective-timezone';
import { orgLocalStartOfDayMinusDaysUtc, cacheTokenForZone } from '../../common/org-local-dates';
import { TicketService } from '../ticket/ticket.service';
import { BranchHoursService } from '../branch/branch-hours.service';

/**
 * Manages service queues within branches.
 * Handles queue configuration, ticket flow, and wait-time estimation.
 */
@Injectable()
export class QueueService {
  private static readonly QUEUE_UPDATE_FORBIDDEN_FIELDS = [
    'status',
    'nextTicketSeq',
    'sessionOpenedAt',
    'sessionClosesAt',
  ] as const;

  private normalizeJourneyMode(mode?: string | null): 'single_ticket' | 'visit_multi_step' | null {
    if (mode == null || mode === '') return null;
    if (mode === 'single_ticket' || mode === 'visit_multi_step') return mode;
    throw new BadRequestException(
      'Invalid journey mode. Supported values: single_ticket, visit_multi_step',
    );
  }

  private normalizeStepRole(role?: string | null): 'service' | 'pickup' | null {
    if (role == null || role === '') return null;
    if ((QUEUE_STEP_ROLES as readonly string[]).includes(role)) return role as 'service' | 'pickup';
    throw new BadRequestException('Invalid step role. Supported values: service, pickup');
  }

  private normalizeCallingPolicy(
    policy?: string | null,
  ): 'fifo' | 'manual_only' | 'ready_then_manual' | 'ready_then_fifo' {
    if (!policy) return 'fifo';
    if ((QUEUE_CALLING_POLICIES as readonly string[]).includes(policy)) {
      return policy as 'fifo' | 'manual_only' | 'ready_then_manual' | 'ready_then_fifo';
    }
    throw new BadRequestException(
      'Invalid calling policy. Supported values: fifo, manual_only, ready_then_manual, ready_then_fifo',
    );
  }

  private enforceQueuePolicyInvariants(data: {
    journeyModeOverride?: string | null;
    stepRole?: string | null;
    callingPolicy?: string | null;
  }) {
    const journeyModeOverride = this.normalizeJourneyMode(data.journeyModeOverride);
    const stepRole = this.normalizeStepRole(data.stepRole);
    const callingPolicyInput = this.normalizeCallingPolicy(data.callingPolicy);

    if (journeyModeOverride === 'visit_multi_step' && !stepRole) {
      throw new BadRequestException('Step role is required when queue journey mode is multi-step');
    }
    if (stepRole === 'pickup' && callingPolicyInput === 'fifo') {
      throw new BadRequestException('Pickup queues cannot use fifo calling policy');
    }

    const callingPolicy = resolveCallingPolicyForStep(stepRole, callingPolicyInput);

    return { journeyModeOverride, stepRole, callingPolicy };
  }

  private async validateFlowTemplateScope(
    orgId: string,
    branchId: string,
    flowTemplateId?: string | null,
  ): Promise<string | null> {
    if (!flowTemplateId) return null;
    const template = await this.prisma.withTenant(orgId, (tx) =>
      tx.branchFlowTemplate.findFirst({
        where: { id: flowTemplateId, orgId },
        select: { id: true, branchId: true },
      }),
    );
    if (!template) throw new NotFoundException('Flow template not found');
    if (template.branchId !== branchId) {
      throw new BadRequestException('Flow template must belong to the same branch as the queue');
    }
    return template.id;
  }

  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private redis: RedisService,
    private readonly planLimits: PlanLimitService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
    private readonly ticketService: TicketService,
    private readonly branchHours: BranchHoursService,
  ) {}

  /** Waiting tickets booked on or after branch-local midnight today. */
  private async countTodayWaitingByQueue(
    orgId: string,
    queues: Array<{ id: string; branchId: string }>,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (queues.length === 0) return counts;

    const queueIdsByBranch = new Map<string, string[]>();
    for (const queue of queues) {
      const ids = queueIdsByBranch.get(queue.branchId) ?? [];
      ids.push(queue.id);
      queueIdsByBranch.set(queue.branchId, ids);
    }

    for (const [branchId, queueIds] of queueIdsByBranch) {
      const tz = await resolveBranchIanaZone(this.prisma, orgId, branchId, this.redis);
      const floor = orgLocalStartOfDayMinusDaysUtc(tz, 0);
      const rows = await this.prisma.withTenant(orgId, (tx) =>
        tx.ticket.groupBy({
          by: ['queueId'],
          where: {
            orgId,
            branchId,
            queueId: { in: queueIds },
            status: 'waiting',
            bookedAt: { gte: floor },
          },
          _count: { _all: true },
        }),
      );
      for (const row of rows) {
        counts.set(row.queueId, row._count._all);
      }
    }

    return counts;
  }

  private async getActorQueueContext(
    orgId: string,
    userId: string,
  ): Promise<{ isOwner: boolean; isAdmin: boolean; canStopEmptyQueue: boolean }> {
    const assignments = await this.prisma.withTenant(orgId, (tx) =>
      tx.roleAssignment.findMany({
        where: { userId, role: { orgId } },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      }),
    );

    let isOwner = false;
    let isAdmin = false;
    let canStopEmptyQueue = false;

    for (const a of assignments) {
      const roleName = a.role.name;
      if (a.role.isSystemRole && roleName === SYSTEM_ROLES.OWNER) {
        isOwner = true;
      }
      if (a.role.isSystemRole && roleName === SYSTEM_ROLES.ADMIN) {
        isAdmin = true;
      }

      if (roleName === SYSTEM_ROLES.VIEWER) {
        continue;
      }

      for (const rp of a.role.rolePermissions) {
        const { resource, action } = rp.permission;
        if (resource !== 'queue') continue;
        if (action === 'manage' || action === 'update') {
          canStopEmptyQueue = true;
        }
      }
    }

    return { isOwner, isAdmin, canStopEmptyQueue };
  }

  /**
   * Returns all queues in the org, optionally filtered to a branch and/or service.
   * Waiting count comes from the `_count` aggregate in the same query. Serving
   * Live waiting count and average wait are surfaced by the per-queue stats endpoint
   * (`queue:stats:v2:*`), not here, to keep this list query a single DB round-trip
   * plus one Prisma call — no per-queue Redis fan-out.
   * Waiting counts here are branch-local **today only**; prior-session waiting is
   * marked no-show before the list is built.
   */
  async list(
    orgId: string,
    branchId?: string,
    serviceId?: string,
    allowedBranchIds?: string[] | null,
    surface?: 'classic' | 'journey',
  ) {
    if (!branchId && Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0) {
      return [];
    }

    if (this.config.get<boolean>('app.queue.closePriorSessionWaiting', true)) {
      try {
        await this.ticketService.closePriorSessionWaitingTickets({ orgId });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'unknown error';
        this.logger.warn(`Prior-session waiting cleanup failed during queue list: ${detail}`);
      }
    }

    const where: any = { orgId };
    if (branchId) {
      where.branchId = branchId;
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    if (serviceId) where.serviceId = serviceId;

    const queues = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.queue.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    const waitingByQueueId = await this.countTodayWaitingByQueue(
      orgId,
      queues.map((q) => ({ id: q.id, branchId: q.branchId })),
    );

    const templateIds = [
      ...new Set(queues.map((q) => q.flowTemplateId).filter((id): id is string => Boolean(id))),
    ];
    const flowSteps =
      templateIds.length > 0
        ? await this.prisma.withTenant(orgId, (tx) =>
            tx.branchFlowStep.findMany({
              where: { orgId, templateId: { in: templateIds } },
              select: { templateId: true, queueId: true, stepRole: true, callingPolicy: true },
            }),
          )
        : [];
    const templates =
      templateIds.length > 0
        ? await this.prisma.withTenant(orgId, (tx) =>
            tx.branchFlowTemplate.findMany({
              where: { orgId, id: { in: templateIds } },
              select: { id: true, name: true },
            }),
          )
        : [];
    const templateNameById = new Map(templates.map((t) => [t.id, t.name]));
    const flowStepPolicyByQueue = new Map(
      flowSteps
        .filter((step): step is typeof step & { queueId: string } => Boolean(step.queueId))
        .map((step) => [
          `${step.templateId}:${step.queueId}`,
          resolveCallingPolicyForStep(step.stepRole, step.callingPolicy),
        ]),
    );

    const enriched = queues.map((q) => {
      const flowPolicy = q.flowTemplateId
        ? flowStepPolicyByQueue.get(`${q.flowTemplateId}:${q.id}`)
        : undefined;
      const callingPolicy = flowPolicy ?? resolveCallingPolicyForStep(q.stepRole, q.callingPolicy);
      return {
        ...q,
        callingPolicy,
        flowTemplateName: q.flowTemplateId ? templateNameById.get(q.flowTemplateId) : undefined,
        waitingCount: waitingByQueueId.get(q.id) ?? 0,
        servingCount: 0,
        avgWaitMinutes: 0,
      };
    });

    const readFilterEnabled = this.config.get<boolean>('app.surfaceIsolation.readFilter', true);
    if (!surface || !readFilterEnabled) return enriched;
    return enriched.filter((q) => {
      const journeyManaged = q.journeyModeOverride === 'visit_multi_step' || !!q.flowTemplateId;
      return surface === 'journey' ? journeyManaged : !journeyManaged;
    });
  }

  async listForPrincipal(
    orgId: string,
    userId: string,
    branchId?: string,
    serviceId?: string,
    surface?: 'classic' | 'journey',
  ) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
    } else if (allowed !== null && allowed.length === 0) {
      return [];
    }
    return this.list(orgId, branchId, serviceId, allowed, surface);
  }

  /**
   * Returns a single queue with its branch, service, rules, and the first
   * 50 waiting/serving tickets in priority + arrival order.
   */
  async getById(orgId: string, queueId: string) {
    const queue = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.queue.findFirst({
        where: { id: queueId, orgId },
        include: {
          branch: true,
          service: true,
          queueRules: true,
          tickets: {
            where: { status: { in: ['waiting', 'called', 'serving'] } },
            orderBy: [{ priority: 'desc' }, { bookedAt: 'asc' }],
            take: 50,
          },
        },
      });
    });
    if (!queue) throw new NotFoundException('Queue not found');
    return queue;
  }

  async create(
    orgId: string,
    data: {
      branchId: string;
      serviceId: string;
      name: string;
      prefix: string;
      maxCapacity?: number;
      journeyModeOverride?: string | null;
      stepRole?: string | null;
      callingPolicy?: string | null;
      flowTemplateId?: string | null;
    },
  ) {
    // Verify branch and service belong to the org
    const branch = await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.findFirst({ where: { id: data.branchId, orgId } }),
    );
    if (!branch) throw new NotFoundException('Branch not found');
    const service = await this.prisma.withTenant(orgId, (tx) =>
      tx.service.findFirst({ where: { id: data.serviceId, orgId } }),
    );
    if (!service) throw new NotFoundException('Service not found');

    await this.prisma.withTenant(orgId, async (tx) => {
      await assertServiceAssignedToBranchForQueue(tx, orgId, data.branchId, data.serviceId);
      await assertQueuePrefixAvailable(tx, orgId, data.branchId, data.prefix);
    });

    // Check per-branch queue limit (hard-block)
    const currentQueueCount = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.count({
        where: { branchId: data.branchId, orgId },
      }),
    );
    const limitCheck = await this.planLimits.checkLimit(
      orgId,
      'maxQueuesPerBranch',
      currentQueueCount,
    );
    if (limitCheck.limitReached) {
      throw new ForbiddenException(
        `Queue limit reached for this branch. Your plan allows ${limitCheck.limit} queues per branch. Please upgrade to add more.`,
      );
    }

    const normalized = this.enforceQueuePolicyInvariants({
      journeyModeOverride: data.journeyModeOverride,
      stepRole: data.stepRole,
      callingPolicy: data.callingPolicy,
    });
    const flowTemplateId = await this.validateFlowTemplateScope(
      orgId,
      data.branchId,
      data.flowTemplateId,
    );

    const queue = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.create({
        data: {
          orgId,
          branchId: data.branchId,
          serviceId: data.serviceId,
          name: data.name,
          prefix: data.prefix.toUpperCase(),
          maxCapacity: data.maxCapacity,
          maxServiceMinutes: service.durationMinutes ?? 15,
          journeyModeOverride: normalized.journeyModeOverride,
          stepRole: normalized.stepRole,
          callingPolicy: normalized.callingPolicy,
          flowTemplateId,
          status: 'closed',
        },
      }),
    );

    return queue;
  }

  async update(orgId: string, queueId: string, data: QueueUpdateDto) {
    const forbiddenFields = QueueService.QUEUE_UPDATE_FORBIDDEN_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(data, field),
    );
    if (forbiddenFields.length > 0) {
      throw new BadRequestException(
        `Queue lifecycle fields cannot be updated via PATCH: ${forbiddenFields.join(', ')}`,
      );
    }

    const queue = await this.getById(orgId, queueId);
    const isFlowManaged = Boolean(queue.flowTemplateId);
    const attemptsFlowManagedPolicyEdit =
      data.journeyModeOverride !== undefined ||
      data.stepRole !== undefined ||
      data.callingPolicy !== undefined;
    if (isFlowManaged && attemptsFlowManagedPolicyEdit && data.flowTemplateId === undefined) {
      throw new BadRequestException(
        'This queue is managed by an active flow template. Update queue type and calling rule from Flows, or unlink the template first.',
      );
    }

    // If branch or service is being changed, verify they belong to the org
    if (data.branchId) {
      const branch = await this.prisma.withTenant(orgId, (tx) =>
        tx.branch.findFirst({ where: { id: data.branchId, orgId } }),
      );
      if (!branch) throw new NotFoundException('Branch not found');
    }
    if (data.serviceId) {
      const service = await this.prisma.withTenant(orgId, (tx) =>
        tx.service.findFirst({ where: { id: data.serviceId, orgId } }),
      );
      if (!service) throw new NotFoundException('Service not found');
    }

    const effectiveBranchId = data.branchId ?? queue.branchId;
    const normalized = this.enforceQueuePolicyInvariants({
      journeyModeOverride: data.journeyModeOverride ?? queue.journeyModeOverride,
      stepRole: data.stepRole === undefined ? queue.stepRole : data.stepRole,
      callingPolicy: data.callingPolicy ?? queue.callingPolicy,
    });
    const flowTemplateId = await this.validateFlowTemplateScope(
      orgId,
      effectiveBranchId,
      data.flowTemplateId === undefined ? queue.flowTemplateId : data.flowTemplateId,
    );
    const updateData: {
      name?: string;
      prefix?: string;
      maxCapacity?: number | null;
      branchId?: string;
      serviceId?: string;
      journeyModeOverride: 'single_ticket' | 'visit_multi_step' | null;
      stepRole: 'service' | 'pickup' | null;
      callingPolicy: 'fifo' | 'manual_only' | 'ready_then_manual' | 'ready_then_fifo';
      flowTemplateId: string | null;
    } = {
      journeyModeOverride: normalized.journeyModeOverride,
      stepRole: normalized.stepRole,
      callingPolicy: normalized.callingPolicy,
      flowTemplateId,
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.prefix !== undefined) updateData.prefix = data.prefix.toUpperCase();
    if (data.maxCapacity !== undefined) updateData.maxCapacity = data.maxCapacity;
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.serviceId !== undefined) updateData.serviceId = data.serviceId;

    const normalizedUpdate = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.update({
        where: { id: queueId },
        data: updateData,
      }),
    );

    // Notify both old and new branch displays if branch changed
    if (data.branchId && data.branchId !== queue.branchId) {
      await this.realtime.publish(`display:${queue.branchId}`, {
        event: 'queue.deleted',
        data: { id: queueId },
      });
      await this.realtime.publish(`display:${data.branchId}`, {
        event: 'queue.updated',
        data: normalizedUpdate,
      });
    } else {
      await this.realtime.publish(`display:${queue.branchId}`, {
        event: 'queue.updated',
        data: normalizedUpdate,
      });
    }

    await this.realtime.publish(`org:${orgId}`, { event: 'queue.updated', data: normalizedUpdate });
    return normalizedUpdate;
  }

  async open(orgId: string, queueId: string) {
    const queue = await this.getById(orgId, queueId);
    if (queue.status === 'open') throw new BadRequestException('Queue is already open');
    await this.branchHours.assertBranchAcceptsCustomerIntake(
      orgId,
      queue.branchId,
      'opening the queue',
    );
    const updated = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.update({
        where: { id: queueId },
        data: { status: 'open' },
      }),
    );
    await this.realtime.publish(`display:${queue.branchId}`, {
      event: 'queue.updated',
      data: updated,
    });
    await this.realtime.publish(`org:${orgId}`, { event: 'queue.updated', data: updated });
    return updated;
  }

  async pause(orgId: string, queueId: string) {
    const queue = await this.getById(orgId, queueId);
    if (queue.status !== 'open') throw new BadRequestException('Queue must be open to pause');
    const updated = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.update({
        where: { id: queueId },
        data: { status: 'paused' },
      }),
    );
    await this.realtime.publish(`display:${queue.branchId}`, {
      event: 'queue.updated',
      data: updated,
    });
    await this.realtime.publish(`org:${orgId}`, { event: 'queue.updated', data: updated });
    return updated;
  }

  async close(
    orgId: string,
    queueId: string,
    actorUserId: string,
    options?: { forceCloseWaiting?: boolean; acknowledgeConsequences?: boolean },
  ) {
    await this.getById(orgId, queueId);
    const waitingCount = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.ticket.count({
        where: { orgId, queueId, status: 'waiting' },
      });
    });

    const userContext = await this.getActorQueueContext(orgId, actorUserId);
    if (!canStopQueue(userContext, waitingCount)) {
      throw new ForbiddenException(
        waitingCount > 0
          ? 'Only the organization owner or admin can stop a queue while customers are still waiting.'
          : 'You do not have permission to stop this queue.',
      );
    }

    if (waitingCount > 0) {
      if (!options?.forceCloseWaiting || !options?.acknowledgeConsequences) {
        throw new BadRequestException(
          'Stopping this queue will end it for all waiting customers. Owner or admin must confirm forceCloseWaiting=true and acknowledgeConsequences=true. Consequences are yours.',
        );
      }
    }

    const updated = await this.prisma.withTenant(orgId, (tx) =>
      tx.queue.update({
        where: { id: queueId },
        data: {
          status: 'closed',
          nextTicketSeq: 1,
          sessionOpenedAt: null,
          sessionClosesAt: null,
        },
        include: { branch: true },
      }),
    );
    await this.realtime.publish(`display:${updated.branchId}`, {
      event: 'queue.updated',
      data: updated,
    });
    await this.realtime.publish(`org:${orgId}`, { event: 'queue.updated', data: updated });
    return updated;
  }

  async delete(orgId: string, queueId: string) {
    await this.getById(orgId, queueId);
    await this.prisma.withTenant(orgId, (tx) => tx.queue.delete({ where: { id: queueId } }));
  }

  /**
   * Public endpoint — no auth required. Returns open queues for a branch
   * along with live waiting count and average wait minutes.
   */
  async getPublicQueues(branchId: string) {
    const branch = await this.prisma.withBypassRls((tx) =>
      tx.branch.findUnique({
        where: { id: branchId },
        select: { orgId: true, name: true },
      }),
    );
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const effectiveTz = await resolveEffectiveIanaZone(
      this.prisma,
      branch.orgId,
      { branchId },
      this.redis,
    );
    const tzToken = cacheTokenForZone(effectiveTz);
    const lookbackStart = orgLocalStartOfDayMinusDaysUtc(effectiveTz, 0);

    const { flowSteps, allFlowBoundQueueIds, rawQueues } = await this.prisma.withTenant(
      branch.orgId,
      async (tx) => {
        const steps = await loadActiveFlowStepsForBranch(tx as any, branch.orgId, branchId);
        const boundIds = await getAllFlowBoundQueueIds(tx as any, branch.orgId, branchId);
        const nonEntryQueueIds = getNonEntryQueueIdsFromFlowSteps(steps);
        const queues = await tx.queue.findMany({
          where: {
            branchId,
            status: 'open',
            OR: [{ stepRole: null }, { stepRole: { not: 'pickup' } }],
            ...(nonEntryQueueIds.size > 0 ? { id: { notIn: [...nonEntryQueueIds] } } : {}),
          },
          include: {
            service: { select: { id: true, name: true, description: true } },
            _count: {
              select: {
                tickets: { where: { status: 'waiting', bookedAt: { gte: lookbackStart } } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
        return { flowSteps: steps, allFlowBoundQueueIds: boundIds, rawQueues: queues };
      },
    );

    const showWaitEstimates = flowSteps.length < 2;

    const journeyPathsByTemplate = new Map<string, string[]>();

    // Group steps by templateId to build distinct journey paths
    const stepsByTemplate = flowSteps.reduce(
      (acc, step) => {
        if (!acc[step.templateId]) acc[step.templateId] = [];
        acc[step.templateId].push(step);
        return acc;
      },
      {} as Record<string, typeof flowSteps>,
    );

    for (const [templateId, steps] of Object.entries(stepsByTemplate)) {
      if (steps.length >= 2) {
        journeyPathsByTemplate.set(
          templateId,
          [...steps]
            .sort((a, b) => a.stepIndex - b.stepIndex)
            .map((s) => s.service?.name ?? s.queue?.name ?? `Step ${s.stepIndex}`),
        );
      }
    }

    const queues = filterPublicKioskQueues(rawQueues, flowSteps, allFlowBoundQueueIds);

    // Batch-read live stats in one MGET round-trip instead of N serial GETs.
    const statsList = await this.redis.mgetJson<{
      waitingCount: number;
      servingCount: number;
      avgWaitMinutes: number;
    }>(queues.map((q) => `queue:stats:v2:${q.id}:today:${tzToken}`));

    const enriched = queues.map((q, i) => {
      const stats = statsList[i];
      const templateSteps = q.flowTemplateId ? stepsByTemplate[q.flowTemplateId] : undefined;
      const journeyPath = q.flowTemplateId
        ? journeyPathsByTemplate.get(q.flowTemplateId)
        : undefined;

      return {
        id: q.id,
        name: q.name,
        prefix: q.prefix,
        status: q.status,
        service: q.service,
        waitingCount: stats?.waitingCount ?? q._count.tickets,
        avgWaitMinutes: showWaitEstimates ? (stats?.avgWaitMinutes ?? 0) : 0,
        journeyModeOverride: q.journeyModeOverride,
        flowTemplateId: q.flowTemplateId,
        stepRole: q.stepRole,
        journeyPath:
          journeyPath &&
          templateSteps &&
          q.id === [...templateSteps].sort((a, b) => a.stepIndex - b.stepIndex)[0]?.queueId
            ? journeyPath
            : undefined,
      };
    });

    const nameSetting = await this.prisma.withTenant(branch.orgId, (tx) =>
      tx.setting.findFirst({
        where: { orgId: branch.orgId, key: 'kiosk_name_required', scope: 'org' },
      }),
    );
    const kioskNameRequired = nameSetting ? nameSetting.value === true : false;

    const crmEnabled = await this.patronCrmFeature.isEnabled(branch.orgId);

    const org = await this.prisma.organization.findUnique({
      where: { id: branch.orgId },
      select: { name: true, logoUrl: true, website: true, country: true, industry: true },
    });
    const smsComplianceComplete = !!(
      org &&
      org.website &&
      org.website.trim() &&
      org.country &&
      org.country.trim() &&
      org.industry &&
      org.industry.trim()
    );

    return {
      queues: enriched,
      showWaitEstimates,
      meta: {
        kioskNameRequired,
        smsComplianceComplete,
        crmEnabled,
        branchName: branch.name,
        organization: {
          name: org?.name ?? 'Organization',
          logoUrl: org?.logoUrl ?? null,
        },
      },
    };
  }
}
