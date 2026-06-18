import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  normalizeSmsRecipient,
  CURRENT_PRIVACY_VERSION,
  journeyStepAcceptsExternalRef,
  type QueueCallingPolicy,
} from '@queueplatform/shared';
import { Prisma } from '@prisma/client';
import { assertPublicQueueEntryAllowed } from '../queue/flow-public-entry';
import type { PlanLimitService } from '../billing/plan-limit.service';
import type { PrismaService } from '../../prisma/prisma.service';

type JourneyMode = 'single_ticket' | 'visit_multi_step';

export type IssueTicketData = {
  queueId: string;
  branchId: string;
  serviceId: string;
  visitId?: string;
  stepIndex?: number;
  deskNumber?: string;
  initialStatus?: 'waiting' | 'called' | 'serving';
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  transactionalSmsAllowed?: boolean;
  marketingSmsConsent?: boolean;
  marketingEmailConsent?: boolean;
  source: string;
  priority?: number;
  language?: string;
  note?: string;
  externalRef?: string;
};

export type TicketIssuancePlanLimits = Pick<PlanLimitService, 'checkLimit'>;

type TicketIssuanceDeps = {
  prisma: PrismaService;
  planLimits: TicketIssuancePlanLimits;
  stampRequestContext: (orgId: string, fields?: { ticketId?: string; queueId?: string }) => void;
  getMonthlyTicketCount: (orgId: string) => Promise<number>;
  isVisitJourneysEnabledForOrg: (
    orgId: string,
    tx: Prisma.TransactionClient | PrismaService,
  ) => Promise<boolean>;
  resolveEffectiveJourneyMode: (
    tx: Prisma.TransactionClient | PrismaService,
    orgId: string,
    branchId: string,
    serviceId: string,
    queueId?: string,
  ) => Promise<JourneyMode>;
  reserveQueueDisplayNumber: (
    tx: Prisma.TransactionClient,
    orgId: string,
    queueId: string,
    opts?: { enforceOpenForNonStaff?: boolean; source?: string },
  ) => Promise<{ displayNumber: string; status: string }>;
  resolveQueueCallingPolicy: (
    tx: Prisma.TransactionClient | PrismaService,
    orgId: string,
    queueId: string,
  ) => Promise<QueueCallingPolicy>;
  isReadyGatedPolicy: (policy?: string | null) => boolean;
  resolveFlowStepIndexForQueue: (
    tx: Prisma.TransactionClient | PrismaService,
    orgId: string,
    branchId: string,
    queueId: string,
    visitId?: string,
  ) => Promise<number | null>;
  resolveVisitExternalRef: (
    tx: Prisma.TransactionClient | PrismaService,
    orgId: string,
    visitId: string,
    fallbackTicketId?: string | null,
  ) => Promise<string | null>;
  logSmsConsentEvent: (input: {
    orgId: string;
    action: 'consent.sms.captured' | 'consent.sms.updated';
    resourceId?: string | null;
    metadata: Prisma.InputJsonObject;
  }) => Promise<void>;
  logMarketingConsent: (
    tx: Prisma.TransactionClient,
    input: {
      orgId: string;
      customerId: string;
      channel: 'sms' | 'email';
      status: 'GRANTED' | 'REVOKED';
      source: string;
      version: string;
    },
  ) => Promise<void>;
  emitTicketIssuedSideEffects: (
    orgId: string,
    ticket: any,
    queueId: string,
    branchId: string,
  ) => void;
  assertBranchAcceptsCustomerIntake: (
    tx: Prisma.TransactionClient,
    orgId: string,
    branchId: string,
    actionLabel: string,
  ) => Promise<void>;
};

@Injectable()
export class TicketIssuanceService {
  async issueTicket(
    deps: TicketIssuanceDeps,
    orgIdOrNull: string | null | undefined,
    data: IssueTicketData,
    issuance: 'public' | 'authenticated' = 'public',
  ) {
    const sourceNorm = String(data.source ?? '')
      .trim()
      .toLowerCase();
    const normalizedPhone = data.customerPhone
      ? normalizeSmsRecipient(String(data.customerPhone))
      : undefined;
    if (data.transactionalSmsAllowed === true && !normalizedPhone) {
      throw new BadRequestException(
        'SMS notifications require a valid mobile number in international format (e.g. +15550001234)',
      );
    }
    if (normalizedPhone) {
      data.customerPhone = normalizedPhone;
    } else if (!data.customerPhone) {
      data.customerPhone = undefined;
    }

    if (issuance === 'public') {
      if (sourceNorm === 'staff') {
        throw new ForbiddenException('Staff-issued tickets require an authenticated staff session');
      }
      if (sourceNorm === 'kiosk' && data.transactionalSmsAllowed === true && !data.customerPhone) {
        throw new BadRequestException(
          'Kiosk SMS notifications require a valid mobile number in international format (e.g. +15550001234)',
        );
      }
    }

    let orgId = orgIdOrNull;
    if (!orgId) {
      const branch = await deps.prisma.withBypassRls((tx) =>
        tx.branch.findUnique({
          where: { id: data.branchId },
          select: { orgId: true },
        }),
      );
      if (!branch) throw new NotFoundException('Branch not found');
      orgId = branch.orgId;
    }
    if (typeof orgId !== 'string' || orgId.length === 0) {
      throw new NotFoundException('Organization could not be resolved for this ticket');
    }

    deps.stampRequestContext(orgId, { queueId: data.queueId });

    if (issuance === 'public' && !data.visitId) {
      await assertPublicQueueEntryAllowed(deps.prisma, orgId, data.branchId, data.queueId);
    }

    const ticketsThisMonth = await deps.getMonthlyTicketCount(orgId);
    const ticketLimitCheck = await deps.planLimits.checkLimit(
      orgId,
      'maxTicketsPerMonth',
      ticketsThisMonth,
    );
    if (ticketLimitCheck.limitReached) {
      throw new ForbiddenException(
        `Monthly ticket limit reached. Your plan allows ${ticketLimitCheck.limit} tickets per month. Please upgrade to issue more.`,
      );
    }

    const payload = await this.prepareIssueTicketPayload(deps, orgId, data);
    const ticket = await deps.prisma.withTenant(
      orgId,
      async (tx) => this.issueTicketCore(deps, tx, orgId, payload),
      { timeoutMs: 15_000, maxWaitMs: 10_000 },
    );

    const resolvedConsent = data.transactionalSmsAllowed ?? false;
    await deps.logSmsConsentEvent({
      orgId,
      action: 'consent.sms.captured',
      resourceId: ticket.customerId ?? ticket.id,
      metadata: {
        source: data.source ?? (issuance === 'public' ? 'public_issue' : 'authenticated_issue'),
        policyVersion: CURRENT_PRIVACY_VERSION,
        channel: 'sms',
        purpose: 'transactional_queue_updates',
        transactionalSmsAllowed: resolvedConsent,
        ticketId: ticket.id,
        issuance,
      },
    });

    deps.emitTicketIssuedSideEffects(orgId, ticket, data.queueId, data.branchId);

    let warning: string | undefined;
    if (resolvedConsent) {
      const org = await deps.prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, website: true, country: true, industry: true },
      });
      if (!org?.name?.trim() || !org?.website || !org?.country || !org?.industry) {
        warning =
          'SMS was NOT sent. Organization profile (website, country, industry) must be complete to send SMS.';
      }
    }

    if (warning) return { ...ticket, warning };
    return ticket;
  }

  async prepareIssueTicketPayload(
    deps: TicketIssuanceDeps,
    orgId: string,
    data: IssueTicketData,
  ): Promise<IssueTicketData> {
    if (data.stepIndex != null) return data;

    const journeysEnabled = await deps.isVisitJourneysEnabledForOrg(orgId, deps.prisma);
    if (!journeysEnabled) return data;

    const journeyMode = await deps.resolveEffectiveJourneyMode(
      deps.prisma,
      orgId,
      data.branchId,
      data.serviceId,
      data.queueId,
    );

    if (journeyMode !== 'visit_multi_step' && !data.visitId) return data;

    const stepIndex = await deps.resolveFlowStepIndexForQueue(
      deps.prisma,
      orgId,
      data.branchId,
      data.queueId,
      data.visitId,
    );
    if (stepIndex === null) return data;

    return { ...data, stepIndex };
  }

  async issueTicketCore(
    deps: TicketIssuanceDeps,
    tx: Prisma.TransactionClient,
    orgId: string,
    data: IssueTicketData,
  ) {
    const branch = await tx.branch.findUnique({
      where: { id: data.branchId },
      select: { orgId: true },
    });
    if (!branch || branch.orgId !== orgId) {
      throw new NotFoundException('Branch not found');
    }

    await deps.assertBranchAcceptsCustomerIntake(tx, orgId, data.branchId, 'issuing tickets');

    const service = await tx.service.findUnique({
      where: { id: data.serviceId },
      select: { orgId: true },
    });
    if (!service || service.orgId !== orgId) {
      throw new NotFoundException('Service not found');
    }

    const queue = await tx.queue.findUnique({
      where: { id: data.queueId },
      select: {
        id: true,
        branchId: true,
        serviceId: true,
        status: true,
        orgId: true,
        flowTemplateId: true,
      },
    });
    if (!queue) {
      throw new NotFoundException('Queue not found');
    }
    if (queue.branchId !== data.branchId || queue.serviceId !== data.serviceId) {
      throw new BadRequestException('branchId and serviceId must match the selected queue');
    }

    const journeyMode = await deps.resolveEffectiveJourneyMode(
      tx,
      orgId,
      data.branchId,
      data.serviceId,
      data.queueId,
    );
    const journeysEnabled = await deps.isVisitJourneysEnabledForOrg(orgId, tx);
    const effectiveJourneyMode: JourneyMode = journeysEnabled ? journeyMode : 'single_ticket';
    let visitId = data.visitId;
    let reusedDisplayNumber: string | null = null;

    if (visitId) {
      const visit = await tx.visit.findFirst({
        where: { id: visitId, orgId, branchId: data.branchId },
        select: { id: true, status: true },
      });
      if (!visit) {
        throw new NotFoundException('Visit not found');
      }
      if (visit.status === 'completed') {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'active', completedAt: null },
        });
      } else if (visit.status !== 'active') {
        throw new BadRequestException('Visit is not active');
      }

      const firstTicket = await tx.ticket.findFirst({
        where: { visitId, orgId },
        orderBy: { stepIndex: 'asc' },
        select: { displayNumber: true },
      });
      if (firstTicket) {
        reusedDisplayNumber = firstTicket.displayNumber;
      }
    } else if (effectiveJourneyMode === 'visit_multi_step') {
      const visit = await tx.visit.create({
        data: {
          orgId,
          branchId: data.branchId,
          source: data.source,
          customerName: data.customerName ?? null,
          customerPhone: data.customerPhone ?? null,
          language: data.language ?? null,
          status: 'active',
        },
        select: { id: true },
      });
      visitId = visit.id;
    }

    let finalDisplayNumber = reusedDisplayNumber;
    if (!finalDisplayNumber) {
      const { displayNumber } = await deps.reserveQueueDisplayNumber(tx, orgId, data.queueId, {
        enforceOpenForNonStaff: true,
      });
      finalDisplayNumber = displayNumber;
    } else {
      const queueForReuse = await tx.queue.findUnique({
        where: { id: data.queueId },
        select: { id: true, status: true, orgId: true },
      });
      if (!queueForReuse || (queueForReuse.orgId && queueForReuse.orgId !== orgId)) {
        throw new NotFoundException('Queue not found');
      }
      const isStaffOrSystem = data.source === 'staff' || data.source === 'system';
      if (!isStaffOrSystem && queueForReuse.status !== 'open') {
        throw new BadRequestException(
          queueForReuse.status === 'closed'
            ? 'Queue is closed. Reopen the queue before issuing tickets.'
            : `Queue is not open (status: ${queueForReuse.status})`,
        );
      }
    }

    const callingPolicy = await deps.resolveQueueCallingPolicy(tx, orgId, data.queueId);
    const readyAt = deps.isReadyGatedPolicy(callingPolicy) ? null : null;

    let customerId = data.customerId;
    let finalName = data.customerName;
    let finalPhone = data.customerPhone;

    const marketingSmsVal = data.marketingSmsConsent === true ? 'GRANTED' : undefined;
    const marketingEmailVal = data.marketingEmailConsent === true ? 'GRANTED' : undefined;
    const hasMarketingUpdate = !!marketingSmsVal || !!marketingEmailVal;

    if (!customerId && data.customerPhone) {
      const customer = await tx.customer.findFirst({
        where: { orgId, phone: data.customerPhone },
      });
      if (customer) {
        finalName = data.customerName || customer.name;
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            name: finalName,
            transactionalSmsAllowed:
              data.transactionalSmsAllowed ?? customer.transactionalSmsAllowed,
            ...(marketingSmsVal && { marketingSmsConsent: marketingSmsVal }),
            ...(marketingEmailVal && { marketingEmailConsent: marketingEmailVal }),
            ...(hasMarketingUpdate && {
              marketingConsentSource: data.source ?? null,
              marketingConsentVersion: CURRENT_PRIVACY_VERSION,
              marketingConsentDate: new Date(),
            }),
          },
        });
        customerId = customer.id;
      } else {
        finalName = data.customerName || 'Anonymous';
        const newCustomer = await tx.customer.create({
          data: {
            orgId,
            name: finalName,
            phone: data.customerPhone,
            transactionalSmsAllowed: data.transactionalSmsAllowed ?? false,
            smsConsentSource: data.source ?? null,
            smsConsentVersion: CURRENT_PRIVACY_VERSION,
            ...(marketingSmsVal && { marketingSmsConsent: marketingSmsVal }),
            ...(marketingEmailVal && { marketingEmailConsent: marketingEmailVal }),
            ...(hasMarketingUpdate && {
              marketingConsentSource: data.source ?? null,
              marketingConsentVersion: CURRENT_PRIVACY_VERSION,
              marketingConsentDate: new Date(),
            }),
          },
        });
        customerId = newCustomer.id;
      }
    } else if (!customerId && data.customerName) {
      finalName = data.customerName;
      const customer = await tx.customer.create({
        data: {
          orgId,
          name: finalName,
          transactionalSmsAllowed: data.transactionalSmsAllowed ?? false,
          smsConsentSource: data.source ?? null,
          ...(marketingSmsVal && { marketingSmsConsent: marketingSmsVal }),
          ...(marketingEmailVal && { marketingEmailConsent: marketingEmailVal }),
          ...(hasMarketingUpdate && {
            marketingConsentSource: data.source ?? null,
            marketingConsentVersion: CURRENT_PRIVACY_VERSION,
            marketingConsentDate: new Date(),
          }),
        },
      });
      customerId = customer.id;
    } else if (customerId) {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (customer) {
        finalName = data.customerName || customer.name;
        finalPhone = data.customerPhone || customer.phone || undefined;
        if (hasMarketingUpdate) {
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              ...(marketingSmsVal && { marketingSmsConsent: marketingSmsVal }),
              ...(marketingEmailVal && { marketingEmailConsent: marketingEmailVal }),
              ...(hasMarketingUpdate && {
                marketingConsentSource: data.source ?? null,
                marketingConsentVersion: CURRENT_PRIVACY_VERSION,
                marketingConsentDate: new Date(),
              }),
            },
          });
        }
      }
    }

    if (customerId) {
      if (marketingSmsVal) {
        await deps.logMarketingConsent(tx, {
          orgId,
          customerId,
          channel: 'sms',
          status: 'GRANTED',
          source: data.source ?? 'api',
          version: CURRENT_PRIVACY_VERSION,
        });
      }
      if (marketingEmailVal) {
        await deps.logMarketingConsent(tx, {
          orgId,
          customerId,
          channel: 'email',
          status: 'GRANTED',
          source: data.source ?? 'api',
          version: CURRENT_PRIVACY_VERSION,
        });
      }
    }

    if (!finalName) finalName = 'Anonymous';

    let stepIndex = data.stepIndex ?? null;
    if (stepIndex === null && (visitId || effectiveJourneyMode === 'visit_multi_step')) {
      stepIndex = await deps.resolveFlowStepIndexForQueue(
        tx,
        orgId,
        data.branchId,
        data.queueId,
        visitId,
      );
    }

    const queueForRef = await tx.queue.findUnique({
      where: { id: data.queueId, orgId },
      select: { stepRole: true },
    });

    let inheritedExternalRef: string | null = null;
    const allowVisitReceiptInherit =
      visitId &&
      journeyStepAcceptsExternalRef(stepIndex, queueForRef?.stepRole) &&
      data.source !== 'system';
    if (allowVisitReceiptInherit) {
      inheritedExternalRef = data.externalRef?.trim() || null;
      if (!inheritedExternalRef) {
        inheritedExternalRef = await deps.resolveVisitExternalRef(tx, orgId, visitId!, null);
      }
    } else if (visitId && journeyStepAcceptsExternalRef(stepIndex, queueForRef?.stepRole)) {
      inheritedExternalRef = data.externalRef?.trim() || null;
    }

    return tx.ticket.create({
      data: {
        orgId,
        queueId: data.queueId,
        branchId: data.branchId,
        serviceId: data.serviceId,
        visitId: visitId ?? null,
        flowTemplateId: queue.flowTemplateId,
        deskNumber: data.deskNumber,
        customerId,
        customerName: finalName,
        customerPhone: finalPhone,
        displayNumber: finalDisplayNumber,
        status: data.initialStatus ?? 'waiting',
        priority: data.priority ?? 0,
        source: data.source,
        language: data.language ?? 'en',
        note: data.note,
        transactionalSmsAllowed: data.transactionalSmsAllowed ?? false,
        stepIndex,
        readyAt,
        bookedAt: new Date(),
        calledAt:
          data.initialStatus === 'called' || data.initialStatus === 'serving' ? new Date() : null,
        servedAt: data.initialStatus === 'serving' ? new Date() : null,
        ...(inheritedExternalRef ? { externalRef: inheritedExternalRef } : {}),
      },
      include: {
        queue: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        visit: { select: { id: true, trackingToken: true } },
      },
    });
  }
}
