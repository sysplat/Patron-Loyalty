import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async getNextStep(orgId: string, templateId: string, currentStepIndex: number) {
    return this.prisma.withTenant(orgId, (tx) =>
      tx.branchFlowStep.findFirst({
        where: {
          templateId,
          orgId,
          stepIndex: { gt: currentStepIndex },
        },
        orderBy: { stepIndex: 'asc' },
        include: {
          service: { select: { id: true, name: true } },
          queue: { select: { id: true, name: true } },
        },
      }),
    );
  }
}
