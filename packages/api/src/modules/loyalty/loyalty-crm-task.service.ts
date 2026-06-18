import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';

@Injectable()
export class LoyaltyCrmTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  async listForCustomer(orgId: string, customerId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmTask.findMany({
        where: { orgId, customerId },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    );
  }

  async listOpen(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmTask.findMany({
        where: { orgId, status: { in: ['open', 'in_progress'] } },
        orderBy: { dueAt: 'asc' },
        take: 100,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    );
  }

  async create(orgId: string, data: Record<string, unknown>) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.crmTask.create({ data: { orgId, ...data } as never }),
    );
  }

  async update(orgId: string, id: string, data: Record<string, unknown>) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.crmTask.findFirst({ where: { id, orgId } }),
    );
    if (!existing) throw new NotFoundException('Task not found');
    return this.prisma.withTenant(orgId, (tx) => tx.crmTask.update({ where: { id }, data }));
  }
}
