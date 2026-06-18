import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildJourneyCompleteErrorPayload,
  JOURNEY_COMPLETE_ERROR_CODES,
  JOURNEY_COMPLETE_FAILURE_LOG_PREFIX,
  type JourneyCompleteErrorCode,
  type JourneyCompleteFailureDetails,
  journeyStepAcceptsExternalRef,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketJourneyFlowService } from './ticket-journey-flow.service';

type JourneyContext = {
  id: string;
  visitId: string | null;
  stepIndex: number | null;
  branchId: string;
  queueId: string;
  deskNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  language: string | null;
  externalRef: string | null;
  flowTemplateId: string | null;
  queue: { stepRole: string | null } | null;
};

type JourneyFinalizeIssueInput = {
  branchId: string;
  queueId: string;
  serviceId: string;
  visitId?: string;
  stepIndex?: number;
  deskNumber?: string;
  initialStatus?: 'waiting' | 'called' | 'serving';
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  language?: string;
  source: string;
  externalRef?: string;
};

type NextTicket = {
  id: string;
  visitId: string | null;
  displayNumber: string;
  status: string;
  readyAt: Date | null;
  customerName: string | null;
  customerPhone: string | null;
  queueId: string;
  branchId: string;
  bookedAt: Date;
  priority: number;
  stepIndex: number | null;
  externalRef: string | null;
  deskNumber: string | null;
  queue?: { id: string; name: string; stepRole?: string | null } | null;
};

type TerminalTicket = Record<string, unknown>;

type JourneyTransitionDeps = {
  isQueueJourneyManaged: (
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    queueId: string,
  ) => Promise<boolean>;
  findTicketForActionResponse: (
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    ticketId: string,
  ) => Promise<TerminalTicket | null>;
  findActiveJourneyFollowUpTicket: (
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    currentTicketId: string,
    visitId: string | null,
    currentStepIndex: number | null,
  ) => Promise<TerminalTicket | null>;
  issueTicketCore: (
    tx: Prisma.TransactionClient,
    orgId: string,
    data: JourneyFinalizeIssueInput,
  ) => Promise<NextTicket>;
  transitionTicketCore: (
    tx: Prisma.TransactionClient,
    orgId: string,
    ticketId: string,
    fromStatus: string | string[],
    toStatus: string,
    extraData: Record<string, unknown>,
  ) => Promise<TerminalTicket>;
  emitTicketIssuedSideEffects: (
    orgId: string,
    ticket: NextTicket,
    queueId: string,
    branchId: string,
  ) => void;
  emitTicketCalledNotification: (
    orgId: string,
    ticket: NextTicket,
    deskNumberOverride?: string,
  ) => void;
  emitTransitionSideEffects: (
    orgId: string,
    ticket: { queueId: string; branchId: string; orgId: string; visitId?: string | null },
    ticketId: string,
    toStatus: string,
  ) => void;
};

@Injectable()
export class TicketJourneyTransitionService {
  private readonly logger = new Logger(TicketJourneyTransitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journeyFlow: TicketJourneyFlowService,
  ) {}

  async finalizeTicketWithJourneyAdvance(input: {
    orgId: string;
    ticketId: string;
    terminalStatus: 'completed' | 'no_show';
    externalRef?: string;
    deps: JourneyTransitionDeps;
  }): Promise<{ ticket: TerminalTicket; nextTicket: NextTicket | null }> {
    const { orgId, ticketId, terminalStatus, externalRef, deps } = input;

    const journeyContext = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.findUnique({
        where: { id: ticketId, orgId },
        select: {
          id: true,
          visitId: true,
          stepIndex: true,
          branchId: true,
          queueId: true,
          deskNumber: true,
          customerId: true,
          customerName: true,
          customerPhone: true,
          language: true,
          externalRef: true,
          flowTemplateId: true,
          queue: { select: { stepRole: true } },
        },
      }),
    );
    if (!journeyContext) {
      throw new NotFoundException('Ticket not found');
    }

    const currentStepAcceptsRef = journeyStepAcceptsExternalRef(
      journeyContext.stepIndex,
      journeyContext.queue?.stepRole,
    );

    // Best-effort pre-check (separate connections) used only for friendly early errors below.
    // The authoritative resolution happens inside the locked transaction (see resolveNextJourneyStepTx).
    let nextStep = await this.journeyFlow.resolveNextJourneyStep(
      orgId,
      journeyContext as JourneyContext,
    );

    if (!nextStep && journeyContext.visitId) {
      const unresolvedNext = await this.journeyFlow.getNextStepResolutionFailure(
        orgId,
        journeyContext as JourneyContext,
      );
      if (unresolvedNext) {
        throw this.journeyCompleteError(
          JOURNEY_COMPLETE_ERROR_CODES.NEXT_QUEUE_NOT_FOUND,
          'The next journey step could not be linked to a queue at this branch. Open the Flows page, re-save your flow template, then complete this step again.',
          journeyContext,
          unresolvedNext,
          'next_queue_unresolved',
          {
            requestedQueueId: unresolvedNext.queueId,
            flowTemplateId: unresolvedNext.templateId,
          },
        );
      }

      const journeyManaged = await deps.isQueueJourneyManaged(
        this.prisma,
        orgId,
        journeyContext.queueId,
      );
      if (journeyManaged) {
        const templateId = await this.journeyFlow.resolveFlowTemplateId(
          this.prisma,
          orgId,
          journeyContext.branchId,
          journeyContext.queueId,
        );
        if (!templateId) {
          throw this.journeyCompleteError(
            JOURNEY_COMPLETE_ERROR_CODES.NOT_CONFIGURED,
            'Multi-step journey is not configured for this branch. Link queues to a flow template or activate one on the Flows page, then complete the step again.',
            journeyContext,
            null,
            'flow_template_missing',
          );
        }
      }
    }

    let terminalTicket: TerminalTicket;
    let nextTicket: NextTicket | null;

    try {
      ({ terminalTicket, nextTicket } = await this.prisma.withTenant(
        orgId,
        async (tx) => {
          const [lockedTicket] = await tx.$queryRaw<
            Array<{
              status: string;
              visitId: string | null;
              stepIndex: number | null;
              flowTemplateId: string | null;
            }>
          >(Prisma.sql`
                SELECT
                    status,
                    visit_id AS "visitId",
                    step_index AS "stepIndex",
                    flow_template_id AS "flowTemplateId"
                FROM tickets
                WHERE id = ${ticketId}::uuid AND org_id = ${orgId}::uuid
                FOR UPDATE
            `);
          if (!lockedTicket) {
            throw new NotFoundException('Ticket not found');
          }

          if (lockedTicket.status === terminalStatus) {
            const terminal = await deps.findTicketForActionResponse(tx, orgId, ticketId);
            if (!terminal) {
              throw new NotFoundException('Ticket not found');
            }
            const followUp = await deps.findActiveJourneyFollowUpTicket(
              tx,
              orgId,
              ticketId,
              lockedTicket.visitId,
              lockedTicket.stepIndex,
            );
            return { terminalTicket: terminal, nextTicket: followUp as NextTicket | null };
          }

          // Authoritative next-step resolution, on the SAME locked connection/RLS context as
          // the row lock and completion. This is what actually drives issuance; the pre-tx
          // value above is only for friendly early errors and can be stale under load.
          const txResolution = await this.journeyFlow.resolveNextJourneyStepTx(tx, orgId, {
            visitId: lockedTicket.visitId,
            stepIndex: lockedTicket.stepIndex,
            branchId: journeyContext.branchId,
            queueId: journeyContext.queueId,
            flowTemplateId: lockedTicket.flowTemplateId,
          });
          nextStep = txResolution.nextStep;

          // A later step is configured but we couldn't resolve/issue it: never silently
          // complete and close the visit. Keep the step active and surface a loud, retryable
          // error (captured in logs + Sentry) instead of dead-ending the customer's journey.
          if (!nextStep && txResolution.hasLaterStep) {
            throw this.journeyCompleteError(
              JOURNEY_COMPLETE_ERROR_CODES.ADVANCE_RESOLUTION_FAILED,
              'Could not resolve the next journey step just now (the service may be briefly degraded). This step was kept active so nothing was lost — please try Complete again in a moment.',
              journeyContext,
              null,
              'advance_resolution_failed',
            );
          }

          const resolvedExternalRef =
            journeyContext.visitId == null
              ? null
              : currentStepAcceptsRef
                ? await this.journeyFlow.resolveVisitExternalRef(
                    tx,
                    orgId,
                    journeyContext.visitId,
                    externalRef ?? journeyContext.externalRef,
                  )
                : null;
          if (journeyContext.visitId && currentStepAcceptsRef && !resolvedExternalRef) {
            throw this.journeyCompleteError(
              JOURNEY_COMPLETE_ERROR_CODES.EXTERNAL_REF_REQUIRED,
              'Transaction number is required from the first step and must be carried through the journey.',
              journeyContext,
              nextStep,
              'external_ref_missing',
            );
          }

          const refForNextStep =
            nextStep && journeyStepAcceptsExternalRef(nextStep.stepIndex) && currentStepAcceptsRef
              ? resolvedExternalRef
              : null;

          let issuedNext: NextTicket | null = null;

          if (nextStep) {
            const nextQueue = await this.journeyFlow.resolveQueueForFlowStep(
              tx,
              orgId,
              journeyContext.branchId,
              nextStep.templateId,
              {
                stepIndex: nextStep.stepIndex,
                serviceId: nextStep.serviceId,
                queueId: nextStep.queueId,
              },
            );
            if (!nextQueue) {
              throw this.journeyCompleteError(
                JOURNEY_COMPLETE_ERROR_CODES.NEXT_QUEUE_NOT_FOUND,
                'The next journey step points to a queue that no longer exists. Update the flow on the Flows page, then complete this step again.',
                journeyContext,
                nextStep,
                'next_queue_unresolved',
                {
                  requestedQueueId: nextStep.queueId,
                },
              );
            }
            if (nextQueue.status !== 'open') {
              throw this.journeyCompleteError(
                JOURNEY_COMPLETE_ERROR_CODES.NEXT_QUEUE_CLOSED,
                'The next queue in the journey is currently closed. It must be open for tickets to transition into it.',
                journeyContext,
                nextStep,
                'next_queue_closed',
                {
                  requestedQueueId: nextStep.queueId,
                  resolvedQueueId: nextQueue.id,
                },
              );
            }
            if (nextQueue.branchId !== journeyContext.branchId) {
              throw this.journeyCompleteError(
                JOURNEY_COMPLETE_ERROR_CODES.NEXT_QUEUE_BRANCH_MISMATCH,
                'The next journey step queue belongs to a different branch. Re-save your flow template for this branch.',
                journeyContext,
                nextStep,
                'next_queue_branch_mismatch',
                {
                  requestedQueueId: nextStep.queueId,
                  resolvedQueueId: nextQueue.id,
                },
              );
            }

            const queueRepaired = nextStep.queueId !== nextQueue.id;
            if (queueRepaired) {
              this.logger.warn(
                JSON.stringify({
                  type: 'journey_complete_queue_repaired',
                  ticketId: journeyContext.id,
                  visitId: journeyContext.visitId,
                  branchId: journeyContext.branchId,
                  requestedQueueId: nextStep.queueId,
                  resolvedQueueId: nextQueue.id,
                  nextStepIndex: nextStep.stepIndex,
                  flowTemplateId: nextStep.templateId,
                }),
              );
            }

            try {
              const nextDeskNumber = nextStep.deskNumber;
              const isSameDesk =
                journeyContext.deskNumber &&
                nextDeskNumber &&
                journeyContext.deskNumber === nextDeskNumber;

              const isCollection = nextQueue.stepRole === 'pickup';
              const autoCall = isSameDesk && !isCollection;

              issuedNext = await deps.issueTicketCore(tx, orgId, {
                branchId: journeyContext.branchId,
                queueId: nextQueue.id,
                serviceId: nextQueue.serviceId,
                visitId: journeyContext.visitId ?? undefined,
                stepIndex: nextStep.stepIndex,
                deskNumber: autoCall ? nextDeskNumber : undefined,
                initialStatus: autoCall ? 'called' : 'waiting',
                customerId: journeyContext.customerId ?? undefined,
                customerName: journeyContext.customerName ?? undefined,
                customerPhone: journeyContext.customerPhone ?? undefined,
                language: journeyContext.language ?? undefined,
                source: 'system',
                ...(refForNextStep ? { externalRef: refForNextStep } : {}),
              });
            } catch (err) {
              if (err instanceof BadRequestException) {
                throw err;
              }
              const failureKind =
                err instanceof NotFoundException && err.message?.toLowerCase().includes('queue')
                  ? 'issue_queue_not_found'
                  : err instanceof NotFoundException
                    ? 'issue_resource_not_found'
                    : 'issue_unknown';
              const detail =
                err instanceof Error ? err.message?.trim() || 'Unknown error' : 'Unknown error';
              const message =
                err instanceof NotFoundException
                  ? `Could not issue the next journey step (${detail}). The ticket was not marked as ${terminalStatus.replace('_', ' ')} so the visit stays active. Check the flow on the Flows page.`
                  : err instanceof HttpException
                    ? err.message
                    : `Could not issue the next step in this visit journey. The ticket was not marked as ${terminalStatus.replace('_', ' ')} so the visit stays active. ${detail}`;
              throw this.journeyCompleteError(
                JOURNEY_COMPLETE_ERROR_CODES.ISSUE_NEXT_FAILED,
                message,
                journeyContext,
                nextStep,
                failureKind,
                {
                  requestedQueueId: nextStep.queueId,
                  resolvedQueueId: nextQueue.id,
                  queueRepaired,
                },
              );
            }
          }

          const terminal = await deps.transitionTicketCore(
            tx,
            orgId,
            ticketId,
            ['called', 'serving'],
            terminalStatus,
            {
              completedAt: new Date(),
              ...(currentStepAcceptsRef && resolvedExternalRef
                ? { externalRef: resolvedExternalRef }
                : {}),
            },
          );

          return { terminalTicket: terminal, nextTicket: issuedNext };
        },
        { timeoutMs: 20_000, maxWaitMs: 10_000 },
      ));
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      if (err instanceof NotFoundException && this.isQueueNotFoundError(err)) {
        throw this.journeyCompleteError(
          JOURNEY_COMPLETE_ERROR_CODES.QUEUE_NOT_FOUND,
          'A queue required for this journey step no longer exists. Re-save your flow on the Flows page, then complete this step again.',
          journeyContext,
          nextStep,
          'queue_not_found',
          {
            requestedQueueId: nextStep?.queueId ?? journeyContext.queueId,
          },
        );
      }
      throw err;
    }

    if (nextTicket) {
      deps.emitTicketIssuedSideEffects(orgId, nextTicket, nextTicket.queueId, nextTicket.branchId);
      if (nextTicket.status === 'called') {
        deps.emitTicketCalledNotification(orgId, nextTicket, nextTicket.deskNumber ?? undefined);
      }
    }
    deps.emitTransitionSideEffects(
      orgId,
      terminalTicket as {
        queueId: string;
        branchId: string;
        orgId: string;
        visitId?: string | null;
      },
      ticketId,
      terminalStatus,
    );

    return { ticket: terminalTicket, nextTicket: nextTicket ?? null };
  }

  private journeyCompleteError(
    code: JourneyCompleteErrorCode,
    message: string,
    journeyContext: JourneyContext,
    nextStep: {
      stepIndex: number;
      serviceId: string;
      queueId: string | null;
      templateId: string;
    } | null,
    failureKind: string,
    extra?: Partial<JourneyCompleteFailureDetails>,
  ): BadRequestException {
    const details: JourneyCompleteFailureDetails = {
      ticketId: journeyContext.id,
      visitId: journeyContext.visitId,
      branchId: journeyContext.branchId,
      currentStepIndex: journeyContext.stepIndex,
      currentQueueId: journeyContext.queueId,
      nextStepIndex: nextStep?.stepIndex ?? null,
      nextQueueId: nextStep?.queueId ?? null,
      nextServiceId: nextStep?.serviceId ?? null,
      flowTemplateId: nextStep?.templateId ?? null,
      reason: message,
      failureKind,
      ...extra,
    };

    this.logger.warn(
      `${JOURNEY_COMPLETE_FAILURE_LOG_PREFIX} ${JSON.stringify({
        code,
        failureKind,
        ticketId: details.ticketId,
        visitId: details.visitId,
        branchId: details.branchId,
        currentStepIndex: details.currentStepIndex,
        currentQueueId: details.currentQueueId,
        nextStepIndex: details.nextStepIndex,
        nextQueueId: details.nextQueueId,
        requestedQueueId: details.requestedQueueId,
        resolvedQueueId: details.resolvedQueueId,
        queueRepaired: details.queueRepaired,
      })}`,
    );

    return new BadRequestException(buildJourneyCompleteErrorPayload(code, message, details));
  }

  private isQueueNotFoundError(err: NotFoundException): boolean {
    const response = err.getResponse();
    if (typeof response === 'string') {
      return response.toLowerCase().includes('queue not found');
    }
    if (response && typeof response === 'object') {
      const message = (response as { message?: unknown }).message;
      return typeof message === 'string' && message.toLowerCase().includes('queue not found');
    }
    return false;
  }
}
