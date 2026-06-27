import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CRM_SALES_STAGES,
  CRM_SUPPORT_TICKET_PRIORITIES,
  CRM_SUPPORT_TICKET_STATUSES,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';

@Injectable()
export class LoyaltyCrmExtendedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  async listSupportTickets(orgId: string, customerId?: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmSupportTicket.findMany({
        where: { orgId, ...(customerId ? { customerId } : {}) },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 100,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    );
  }

  async createSupportTicket(
    orgId: string,
    data: {
      customerId: string;
      subject: string;
      description?: string;
      priority?: string;
      assigneeId?: string;
    },
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const priority = data.priority ?? CRM_SUPPORT_TICKET_PRIORITIES.NORMAL;
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmSupportTicket.create({
        data: {
          orgId,
          customerId: data.customerId,
          subject: data.subject,
          description: data.description,
          priority,
          status: CRM_SUPPORT_TICKET_STATUSES.OPEN,
          assigneeId: data.assigneeId,
        },
      }),
    );
  }

  async updateSupportTicket(
    orgId: string,
    id: string,
    data: {
      subject?: string;
      description?: string | null;
      priority?: string;
      status?: string;
      assigneeId?: string | null;
    },
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.crmSupportTicket.findFirst({ where: { id, orgId } }),
    );
    if (!existing) throw new NotFoundException('Support ticket not found');
    const resolvedAt =
      data.status === CRM_SUPPORT_TICKET_STATUSES.RESOLVED ||
      data.status === CRM_SUPPORT_TICKET_STATUSES.CLOSED
        ? new Date()
        : undefined;
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmSupportTicket.update({
        where: { id },
        data: { ...data, ...(resolvedAt ? { resolvedAt } : {}) },
      }),
    );
  }

  async listSalesOpportunities(orgId: string, customerId?: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmSalesOpportunity.findMany({
        where: { orgId, ...(customerId ? { customerId } : {}) },
        orderBy: [{ stage: 'asc' }, { expectedCloseDate: 'asc' }],
        take: 100,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    );
  }

  async createSalesOpportunity(
    orgId: string,
    data: {
      customerId: string;
      title: string;
      stage?: string;
      valueCents?: number;
      expectedCloseDate?: string;
      notes?: string;
      assigneeId?: string;
    },
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmSalesOpportunity.create({
        data: {
          orgId,
          customerId: data.customerId,
          title: data.title,
          stage: data.stage ?? CRM_SALES_STAGES.LEAD,
          valueCents: data.valueCents ?? 0,
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          notes: data.notes,
          assigneeId: data.assigneeId,
        },
      }),
    );
  }

  async updateSalesOpportunity(
    orgId: string,
    id: string,
    data: {
      title?: string;
      stage?: string;
      valueCents?: number;
      expectedCloseDate?: string | null;
      notes?: string | null;
      assigneeId?: string | null;
    },
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.crmSalesOpportunity.findFirst({ where: { id, orgId } }),
    );
    if (!existing) throw new NotFoundException('Sales opportunity not found');
    const closedAt =
      data.stage === CRM_SALES_STAGES.WON || data.stage === CRM_SALES_STAGES.LOST
        ? new Date()
        : undefined;
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmSalesOpportunity.update({
        where: { id },
        data: {
          ...data,
          expectedCloseDate:
            data.expectedCloseDate === undefined
              ? undefined
              : data.expectedCloseDate
                ? new Date(data.expectedCloseDate)
                : null,
          ...(closedAt ? { closedAt } : {}),
        },
      }),
    );
  }
}
