import { Injectable } from '@nestjs/common';
import type { StationCapability } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type {
  BranchServeContext,
  ServeBranchOption,
  WorkbenchResponse,
  WorkbenchWorkItem,
} from './workbench.types';
import { StationProfileService } from './station-profile.service';
import { AgentSessionService } from './agent-session.service';
import { JourneyDeskAssignmentGuard } from './journey-desk-assignment.guard';
import { WorkbenchBoardService } from './workbench-board.service';
import { WorkbenchCapabilityService } from './workbench-capability.service';
import { WorkbenchJourneySessionService } from './workbench-journey-session.service';
import { WorkbenchQueuePolicyService } from './workbench-queue-policy.service';
import { WorkbenchServeContextService } from './workbench-serve-context.service';
import { WorkbenchWorkItemService } from './workbench-work-item.service';

export { normalizeWorkbenchDeskNumber } from './workbench-desk.util';

@Injectable()
export class WorkbenchService {
  private readonly queuePolicy: WorkbenchQueuePolicyService;
  private readonly workItems: WorkbenchWorkItemService;
  private readonly capabilities: WorkbenchCapabilityService;
  private readonly journeySession: WorkbenchJourneySessionService;
  private readonly serveContext: WorkbenchServeContextService;
  private readonly board: WorkbenchBoardService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly stationProfileService: StationProfileService,
    private readonly agentSessionService: AgentSessionService,
    private readonly journeyDeskAssignmentGuard: JourneyDeskAssignmentGuard,
    queuePolicy?: WorkbenchQueuePolicyService,
    workItems?: WorkbenchWorkItemService,
    capabilities?: WorkbenchCapabilityService,
    journeySession?: WorkbenchJourneySessionService,
    serveContext?: WorkbenchServeContextService,
    board?: WorkbenchBoardService,
  ) {
    this.queuePolicy = queuePolicy ?? new WorkbenchQueuePolicyService(this.prisma);
    this.workItems =
      workItems ??
      new WorkbenchWorkItemService(this.prisma, this.queuePolicy, this.stationProfileService);
    this.capabilities =
      capabilities ?? new WorkbenchCapabilityService(this.prisma, this.stationProfileService);
    this.journeySession =
      journeySession ??
      new WorkbenchJourneySessionService(
        this.prisma,
        this.stationProfileService,
        this.agentSessionService,
        this.journeyDeskAssignmentGuard,
      );
    this.serveContext = serveContext ?? new WorkbenchServeContextService(this.prisma);
    this.board =
      board ??
      new WorkbenchBoardService(
        this.prisma,
        this.redis,
        this.stationProfileService,
        this.agentSessionService,
        this.queuePolicy,
        this.workItems,
      );
  }

  getWorkbench(
    orgId: string,
    userId: string,
    params: Parameters<WorkbenchBoardService['getWorkbench']>[2],
  ): Promise<WorkbenchResponse> {
    return this.board.getWorkbench(orgId, userId, params);
  }

  assertCapability(
    profileQueues: Parameters<WorkbenchCapabilityService['assertCapability']>[0],
    queueId: string,
    capability: StationCapability,
  ): void {
    this.capabilities.assertCapability(profileQueues, queueId, capability);
  }

  assertQueueCapabilityForProfile(
    orgId: string,
    userId: string,
    stationProfileId: string,
    queueId: string,
    capability: StationCapability,
  ): Promise<void> {
    return this.capabilities.assertQueueCapabilityForProfile(
      orgId,
      userId,
      stationProfileId,
      queueId,
      capability,
    );
  }

  assertTicketCapabilityForProfile(
    orgId: string,
    userId: string,
    stationProfileId: string,
    ticketId: string,
    capability: StationCapability,
  ): Promise<{ queueId: string; branchId: string }> {
    return this.capabilities.assertTicketCapabilityForProfile(
      orgId,
      userId,
      stationProfileId,
      ticketId,
      capability,
    );
  }

  getStationProfileById(
    orgId: string,
    userId: string,
    stationProfileId: string,
  ): ReturnType<StationProfileService['getById']> {
    return this.stationProfileService.getById(orgId, userId, stationProfileId);
  }

  resolveActiveFlowTemplateId(orgId: string, branchId: string): Promise<string | null> {
    return this.stationProfileService.resolveActiveFlowTemplateId(orgId, branchId);
  }

  repairJourneyProfileQueues(
    orgId: string,
    stationProfileId: string,
    flowTemplateId: string,
  ): Promise<boolean> {
    return this.stationProfileService.repairJourneyProfileQueues(
      orgId,
      stationProfileId,
      flowTemplateId,
    );
  }

  resolveBranchIdForQueue(orgId: string, queueId: string): Promise<string> {
    return this.capabilities.resolveBranchIdForQueue(orgId, queueId);
  }

  ensureJourneySessionAtDesk(
    orgId: string,
    userId: string,
    input: Parameters<WorkbenchJourneySessionService['ensureJourneySessionAtDesk']>[2],
  ) {
    return this.journeySession.ensureJourneySessionAtDesk(orgId, userId, input);
  }

  assertJourneyQueueDeskAssignment(
    orgId: string,
    userId: string,
    branchId: string,
    queueId: string,
    deskNumber: string,
  ): Promise<void> {
    return this.journeySession.assertJourneyQueueDeskAssignment(
      orgId,
      userId,
      branchId,
      queueId,
      deskNumber,
    );
  }

  resolveDeskForJourneyQueueCall(
    orgId: string,
    userId: string,
    branchId: string,
    queueId: string,
    requestedDeskNumber: string,
  ): Promise<string> {
    return this.journeySession.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      queueId,
      requestedDeskNumber,
    );
  }

  requireActiveJourneyDeskSession(
    orgId: string,
    userId: string,
    input: Parameters<WorkbenchJourneySessionService['requireActiveJourneyDeskSession']>[2],
  ): Promise<{ deskNumber: string }> {
    return this.journeySession.requireActiveJourneyDeskSession(orgId, userId, input);
  }

  establishJourneySession(
    orgId: string,
    userId: string,
    params: Parameters<WorkbenchJourneySessionService['establishJourneySession']>[2],
  ) {
    return this.journeySession.establishJourneySession(orgId, userId, params);
  }

  buildWorkbenchWorkItemForTicket(
    orgId: string,
    userId: string,
    stationProfileId: string,
    ticketId: string,
  ): Promise<WorkbenchWorkItem | null> {
    return this.workItems.buildWorkbenchWorkItemForTicket(
      orgId,
      userId,
      stationProfileId,
      ticketId,
    );
  }

  buildWorkbenchWorkItemFromIssued(
    orgId: string,
    userId: string,
    stationProfileId: string,
    ticket: Parameters<WorkbenchWorkItemService['buildWorkbenchWorkItemFromIssued']>[3],
  ): Promise<WorkbenchWorkItem | null> {
    return this.workItems.buildWorkbenchWorkItemFromIssued(orgId, userId, stationProfileId, ticket);
  }

  assertQueueAllowsManualPrioritize(orgId: string, queueId: string): Promise<void> {
    return this.queuePolicy.assertQueueAllowsManualPrioritize(orgId, queueId);
  }

  branchNeedsWorkbench(orgId: string, branchId: string): Promise<boolean> {
    return this.serveContext.branchNeedsWorkbench(orgId, branchId);
  }

  listServeBranchesForPrincipal(
    orgId: string,
    userId: string,
    surface: 'classic' | 'journey',
  ): Promise<ServeBranchOption[]> {
    return this.serveContext.listServeBranchesForPrincipal(orgId, userId, surface);
  }

  getBranchServeContext(
    orgId: string,
    branchId: string,
    queueId?: string,
    deskNumber?: string,
  ): Promise<BranchServeContext> {
    return this.serveContext.getBranchServeContext(orgId, branchId, queueId, deskNumber);
  }
}
