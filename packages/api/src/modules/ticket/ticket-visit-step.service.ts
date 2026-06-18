import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type IssueTicketInput = {
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
  source: string;
  priority?: number;
  language?: string;
  note?: string;
  externalRef?: string;
};

@Injectable()
export class TicketVisitStepService {
  constructor(private readonly prisma: PrismaService) {}

  async createVisitStep(
    issueTicket: (
      orgId: string,
      data: IssueTicketInput,
      issuance: 'authenticated',
    ) => Promise<unknown>,
    orgId: string,
    visitId: string,
    data: {
      queueId: string;
      serviceId: string;
      deskNumber?: string;
      customerName?: string;
      customerPhone?: string;
      language?: string;
      note?: string;
      source?: string;
      priority?: number;
      transactionalSmsAllowed?: boolean;
    },
  ) {
    const visit = await this.prisma.withTenant(orgId, async (tx) => {
      const row = await tx.visit.findFirst({
        where: { id: visitId, orgId },
        select: {
          id: true,
          branchId: true,
          status: true,
          customerName: true,
          customerPhone: true,
          language: true,
        },
      });
      if (!row) throw new NotFoundException('Visit not found');
      if (row.status === 'completed') {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: 'active', completedAt: null },
        });
        return { ...row, status: 'active' as const };
      }
      if (row.status !== 'active') {
        throw new BadRequestException('Visit is not active');
      }
      return row;
    });

    const ticket = await issueTicket(
      orgId,
      {
        queueId: data.queueId,
        branchId: visit.branchId,
        serviceId: data.serviceId,
        visitId: visit.id,
        deskNumber: data.deskNumber,
        customerName: data.customerName ?? visit.customerName ?? undefined,
        customerPhone: data.customerPhone ?? visit.customerPhone ?? undefined,
        language: data.language ?? visit.language ?? undefined,
        note: data.note,
        source: data.source ?? 'staff',
        priority: data.priority,
        transactionalSmsAllowed: data.transactionalSmsAllowed,
      },
      'authenticated',
    );

    return {
      visitId: visit.id,
      ticket,
    };
  }
}
