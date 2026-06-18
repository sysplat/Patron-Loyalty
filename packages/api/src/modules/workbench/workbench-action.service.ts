import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { STATION_CAPABILITIES } from '@queueplatform/shared';
import { TicketService } from '../ticket/ticket.service';
import { WorkbenchService } from './workbench.service';
import { PrismaService } from '../../prisma/prisma.service';
import { userIsOrganizationSupervisor } from '../../common/rbac/org-owner.util';
import type { WorkbenchCompleteActionResult } from './workbench.types';

/**
 * Service that encapsulates agent actions performed from the Workbench UI.
 * It acts as an orchestrator, ensuring that the acting user has the correct station profile capabilities,
 * an active desk session, and appropriate RBAC permissions before delegating to the core TicketService.
 */
@Injectable()
export class WorkbenchActionService {
  private readonly logger = new Logger(WorkbenchActionService.name);

  constructor(
    private readonly ticketService: TicketService,
    private readonly workbenchService: WorkbenchService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Calls the next available ticket in the specified queue.
   * Ensures the agent's station profile has CALL capabilities and they are at a valid desk.
   */
  async callNext(
    orgId: string,
    userId: string,
    body: {
      stationProfileId: string;
      queueId: string;
      deskNumber: string;
      deskFilterActive?: boolean;
    },
  ) {
    await this.workbenchService.assertQueueCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.queueId,
      STATION_CAPABILITIES.CALL,
    );
    const branchId = await this.workbenchService.resolveBranchIdForQueue(orgId, body.queueId);
    const deskNumber = await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      body.queueId,
      body.deskNumber,
    );
    await this.workbenchService.ensureJourneySessionAtDesk(orgId, userId, {
      stationProfileId: body.stationProfileId,
      branchId,
      deskNumber,
    });
    return this.ticketService.callNext(
      orgId,
      body.queueId,
      deskNumber,
      userId,
      body.deskFilterActive ?? true,
      'workbench',
    );
  }

  /**
   * Calls a specific ticket from the queue manually.
   * Useful when picking a specific customer from a list rather than using FIFO.
   */
  async callSpecific(
    orgId: string,
    userId: string,
    body: { stationProfileId: string; ticketId: string; deskNumber: string },
  ) {
    const ticketScope = await this.workbenchService.assertTicketCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.ticketId,
      STATION_CAPABILITIES.CALL,
    );
    const branchId = ticketScope.branchId;
    const deskNumber = await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      ticketScope.queueId,
      body.deskNumber,
    );
    await this.workbenchService.ensureJourneySessionAtDesk(orgId, userId, {
      stationProfileId: body.stationProfileId,
      branchId,
      deskNumber,
    });
    return this.ticketService.callSpecific(orgId, body.ticketId, deskNumber, userId, 'workbench');
  }

  /**
   * Transitions a ticket from 'called' to 'serving' status.
   * Represents the agent actively working with the customer at the desk.
   */
  async serve(orgId: string, userId: string, body: { stationProfileId: string; ticketId: string }) {
    const ticketScope = await this.workbenchService.assertTicketCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.ticketId,
      STATION_CAPABILITIES.SERVE,
    );
    const branchId = ticketScope.branchId;
    const { deskNumber } = await this.workbenchService.requireActiveJourneyDeskSession(
      orgId,
      userId,
      {
        stationProfileId: body.stationProfileId,
        branchId,
        actionLabel: 'Cannot serve customer',
      },
    );
    await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      ticketScope.queueId,
      deskNumber,
    );
    return this.ticketService.serve(orgId, body.ticketId, userId, 'workbench');
  }

  /**
   * Recalls a ticket, typically ringing a bell or re-announcing the ticket number on lobby displays.
   * Requires the ticket to be currently at the agent's desk (called or serving).
   */
  async recall(
    orgId: string,
    userId: string,
    body: { stationProfileId: string; ticketId: string },
  ) {
    const ticketScope = await this.workbenchService.assertTicketCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.ticketId,
      STATION_CAPABILITIES.SERVE,
    );
    const branchId = ticketScope.branchId;
    const { deskNumber } = await this.workbenchService.requireActiveJourneyDeskSession(
      orgId,
      userId,
      {
        stationProfileId: body.stationProfileId,
        branchId,
        actionLabel: 'Cannot recall customer',
      },
    );
    const resolvedDesk = await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      ticketScope.queueId,
      deskNumber,
    );
    return this.ticketService.recall(orgId, body.ticketId, userId, 'workbench', resolvedDesk);
  }

  /**
   * Marks a ticket as completed successfully.
   * If the ticket is part of a multi-step journey, it may return the next expected ticket state.
   */
  async complete(
    orgId: string,
    userId: string,
    body: { stationProfileId: string; ticketId: string; externalRef?: string },
  ): Promise<WorkbenchCompleteActionResult> {
    const ticketScope = await this.workbenchService.assertTicketCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.ticketId,
      STATION_CAPABILITIES.COMPLETE,
    );
    const branchId = ticketScope.branchId;
    const { deskNumber } = await this.workbenchService.requireActiveJourneyDeskSession(
      orgId,
      userId,
      {
        stationProfileId: body.stationProfileId,
        branchId,
        actionLabel: 'Cannot complete ticket',
      },
    );
    await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      ticketScope.queueId,
      deskNumber,
    );
    const { ticket, nextTicket } = await this.ticketService.complete(
      orgId,
      body.ticketId,
      userId,
      body.externalRef,
      'workbench',
    );
    let nextWorkbenchItem = null;
    if (nextTicket?.id) {
      // The step already advanced and committed above. Building the preview of the
      // next work item is best-effort: a secondary lookup failure here must not turn a
      // successful completion into an error toast (e.g. a misleading 404 "Queue not found").
      // Profile repair for the next step queue runs inside buildWorkbenchWorkItemFromIssued.
      try {
        nextWorkbenchItem = await this.workbenchService.buildWorkbenchWorkItemFromIssued(
          orgId,
          userId,
          body.stationProfileId,
          nextTicket,
        );
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'unknown error';
        this.logger.warn(
          `complete: step advanced (ticket=${body.ticketId}, next=${nextTicket.id}) but next work item preview failed: ${detail}`,
        );
      }
    }
    return {
      ticket: ticket as Record<string, unknown>,
      nextWorkbenchItem,
    };
  }

  /**
   * Marks a ticket as a no-show.
   * Used when a customer was called but did not approach the desk.
   */
  async noShow(
    orgId: string,
    userId: string,
    body: { stationProfileId: string; ticketId: string },
  ) {
    const ticketScope = await this.workbenchService.assertTicketCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.ticketId,
      STATION_CAPABILITIES.NO_SHOW,
    );
    const branchId = ticketScope.branchId;
    const { deskNumber } = await this.workbenchService.requireActiveJourneyDeskSession(
      orgId,
      userId,
      {
        stationProfileId: body.stationProfileId,
        branchId,
        actionLabel: 'Cannot mark no-show',
      },
    );
    await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      ticketScope.queueId,
      deskNumber,
    );
    return this.ticketService.noShow(orgId, body.ticketId, userId, 'workbench');
  }

  /**
   * Transitions a ticket to a 'ready' state.
   * Typically used in multi-step flows (like 'ready_then_manual' policy) where a background task finishes
   * and the customer is now ready to be called back to the desk.
   */
  async markReady(
    orgId: string,
    userId: string,
    body: { stationProfileId: string; ticketId: string },
  ) {
    const ticketScope = await this.workbenchService.assertTicketCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.ticketId,
      STATION_CAPABILITIES.MARK_READY,
    );
    const branchId = ticketScope.branchId;
    const { deskNumber } = await this.workbenchService.requireActiveJourneyDeskSession(
      orgId,
      userId,
      {
        stationProfileId: body.stationProfileId,
        branchId,
        actionLabel: 'Cannot mark ready',
      },
    );
    await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      ticketScope.queueId,
      deskNumber,
    );
    return this.ticketService.markReady(orgId, body.ticketId, userId, 'workbench');
  }

  /**
   * Cancels a ticket, ending its lifecycle prematurely.
   */
  async cancel(
    orgId: string,
    userId: string,
    body: { stationProfileId: string; ticketId: string; reason?: string },
  ) {
    const ticketScope = await this.workbenchService.assertTicketCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.ticketId,
      STATION_CAPABILITIES.CANCEL,
    );
    const branchId = ticketScope.branchId;
    const { deskNumber } = await this.workbenchService.requireActiveJourneyDeskSession(
      orgId,
      userId,
      {
        stationProfileId: body.stationProfileId,
        branchId,
        actionLabel: 'Cannot cancel ticket',
      },
    );
    await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      ticketScope.queueId,
      deskNumber,
    );
    return this.ticketService.cancel(orgId, body.ticketId, userId, body.reason, 'workbench');
  }

  /**
   * Moves a ticket to the front of the queue manually.
   * Restricted to users with supervisor roles (Owner, Admin, or Manager).
   */
  async prioritize(
    orgId: string,
    userId: string,
    body: { stationProfileId: string; ticketId: string },
  ) {
    const ticketScope = await this.workbenchService.assertTicketCapabilityForProfile(
      orgId,
      userId,
      body.stationProfileId,
      body.ticketId,
      STATION_CAPABILITIES.CALL,
    );
    await this.workbenchService.assertQueueAllowsManualPrioritize(orgId, ticketScope.queueId);
    if (!(await userIsOrganizationSupervisor(this.prisma, orgId, userId))) {
      throw new ForbiddenException(
        'Only organization owners, administrators, or managers can reprioritize tickets.',
      );
    }
    const branchId = ticketScope.branchId;
    const { deskNumber } = await this.workbenchService.requireActiveJourneyDeskSession(
      orgId,
      userId,
      {
        stationProfileId: body.stationProfileId,
        branchId,
        actionLabel: 'Cannot prioritize ticket',
      },
    );
    await this.workbenchService.resolveDeskForJourneyQueueCall(
      orgId,
      userId,
      branchId,
      ticketScope.queueId,
      deskNumber,
    );
    return this.ticketService.bringToFirst(orgId, body.ticketId, userId);
  }
}
