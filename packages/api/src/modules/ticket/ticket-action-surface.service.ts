import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActionSurface } from './ticket-action-surface.types';

@Injectable()
export class TicketActionSurfaceService {
  private readonly logger = new Logger(TicketActionSurfaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async isQueueJourneyManaged(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    queueId: string,
  ): Promise<boolean> {
    const queue = await db.queue.findUnique({
      where: { id: queueId, orgId },
      select: { journeyModeOverride: true, flowTemplateId: true },
    });
    if (!queue) {
      return false;
    }
    if (queue.journeyModeOverride === 'visit_multi_step') return true;
    return !!queue.flowTemplateId;
  }

  async isTicketJourneyManaged(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    ticketId: string,
  ): Promise<boolean> {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId, orgId },
      select: {
        id: true,
        visitId: true,
        stepIndex: true,
        queueId: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.visitId) return true;
    return this.isQueueJourneyManaged(db, orgId, ticket.queueId);
  }

  async assertActionSurfaceForQueue(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    queueId: string,
    actionSurface: ActionSurface,
  ): Promise<void> {
    const journeyManaged = await this.isQueueJourneyManaged(db, orgId, queueId);
    const writeBlockEnabled = this.config.get<boolean>('app.surfaceIsolation.writeBlock', true);
    if (actionSurface === 'classic' && journeyManaged) {
      this.logger.warn(
        `[surface_mismatch] code=CLASSIC_ENDPOINT_FORBIDDEN_FOR_FLOW_QUEUE orgId=${orgId} queueId=${queueId} surface=${actionSurface}`,
      );
      if (writeBlockEnabled) {
        throw new BadRequestException({
          code: 'CLASSIC_ENDPOINT_FORBIDDEN_FOR_FLOW_QUEUE',
          message:
            'This queue is a multi-step journey service. Please switch to the Multi-Step Workbench to serve.',
        });
      }
    }
    if (actionSurface === 'workbench' && !journeyManaged) {
      this.logger.warn(
        `[surface_mismatch] code=WORKBENCH_ENDPOINT_FORBIDDEN_FOR_SINGLE_STEP_QUEUE orgId=${orgId} queueId=${queueId} surface=${actionSurface}`,
      );
      if (writeBlockEnabled) {
        throw new BadRequestException({
          code: 'WORKBENCH_ENDPOINT_FORBIDDEN_FOR_SINGLE_STEP_QUEUE',
          message:
            'This queue is a single-step ticket service. Please switch to the Single-Step Console to serve.',
        });
      }
    }
  }

  async assertActionSurfaceForTicket(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    ticketId: string,
    actionSurface: ActionSurface,
  ): Promise<void> {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId, orgId },
      select: { visitId: true, queueId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const journeyManaged = ticket.visitId
      ? true
      : await this.isQueueJourneyManaged(db, orgId, ticket.queueId);
    const writeBlockEnabled = this.config.get<boolean>('app.surfaceIsolation.writeBlock', true);
    if (actionSurface === 'classic' && journeyManaged) {
      this.logger.warn(
        `[surface_mismatch] code=VISIT_TICKET_REQUIRES_WORKBENCH orgId=${orgId} ticketId=${ticketId} surface=${actionSurface}`,
      );
      if (writeBlockEnabled) {
        throw new BadRequestException({
          code: 'VISIT_TICKET_REQUIRES_WORKBENCH',
          message: 'This ticket belongs to a multi-step journey. Use Journey workbench actions.',
        });
      }
    }
    if (actionSurface === 'workbench' && !journeyManaged) {
      this.logger.warn(
        `[surface_mismatch] code=SINGLE_STEP_TICKET_REQUIRES_CLASSIC orgId=${orgId} ticketId=${ticketId} surface=${actionSurface}`,
      );
      if (writeBlockEnabled) {
        throw new BadRequestException({
          code: 'SINGLE_STEP_TICKET_REQUIRES_CLASSIC',
          message: 'This ticket is single-step. Use classic Agent actions.',
        });
      }
    }
  }
}
