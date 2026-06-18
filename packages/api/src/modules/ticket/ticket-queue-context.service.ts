import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  normalizeCallingPolicyValue,
  resolveCallingPolicyForStep,
  type QueueCallingPolicy,
} from '@queueplatform/shared';
import { liveQueueBookedAtFloor as liveQueueBookedAtFloorUtc } from '../../common/live-queue-session';
import {
  resolveEffectiveIanaZone,
  type EffectiveTimezoneContext,
} from '../../common/resolve-effective-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

type JourneyMode = 'single_ticket' | 'visit_multi_step';

@Injectable()
export class TicketQueueContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  getQueueSessionFallbackHours(): number {
    const configured = this.config.get<number>('app.queueSessionFallbackHours');
    const fallback = Number.isFinite(configured) ? Number(configured) : 36;
    return Math.min(72, Math.max(24, Math.floor(fallback)));
  }

  formatDisplayNumber(prefix: string, seq: number): string {
    return `${prefix}${seq.toString().padStart(3, '0')}`;
  }

  normalizeJourneyMode(input?: string | null): JourneyMode {
    if (input === 'visit_multi_step') return 'visit_multi_step';
    return 'single_ticket';
  }

  normalizeCallingPolicy(input?: string | null): QueueCallingPolicy {
    return normalizeCallingPolicyValue(input);
  }

  isReadyGatedPolicy(policy?: string | null): boolean {
    const normalized = this.normalizeCallingPolicy(policy);
    return normalized === 'ready_then_manual' || normalized === 'ready_then_fifo';
  }

  async liveQueueBookedAtFloor(
    orgId: string,
    context: EffectiveTimezoneContext = {},
  ): Promise<Date> {
    const tz = await resolveEffectiveIanaZone(this.prisma, orgId, context, this.redis);
    return liveQueueBookedAtFloorUtc(tz, 0);
  }

  assertTicketInLiveQueue(bookedAt: Date, bookedAtFloor: Date): void {
    if (bookedAt.getTime() < bookedAtFloor.getTime()) {
      throw new BadRequestException(
        "This ticket is from a prior queue session and is no longer in today's waiting line.",
      );
    }
  }

  async isVisitJourneysEnabledForOrg(
    orgId: string,
    tx: Prisma.TransactionClient | PrismaService,
  ): Promise<boolean> {
    if (this.config.get<boolean>('app.visitJourneysGloballyDisabled', false)) {
      return false;
    }
    if (this.config.get<boolean>('app.visitJourneysLegacyGlobalOn', false)) {
      return true;
    }
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { visitJourneysEnabled: true },
    });
    return org?.visitJourneysEnabled === true;
  }

  async resolveEffectiveJourneyMode(
    tx: Prisma.TransactionClient | PrismaService,
    orgId: string,
    branchId: string,
    serviceId: string,
    queueId?: string,
  ): Promise<JourneyMode> {
    const queue = queueId
      ? await tx.queue.findUnique({
          where: { id: queueId, orgId },
          select: { journeyModeOverride: true },
        })
      : null;
    if (queue?.journeyModeOverride) return this.normalizeJourneyMode(queue.journeyModeOverride);

    const branchService = await tx.branchService.findUnique({
      where: { branchId_serviceId: { branchId, serviceId } },
      select: { journeyModeOverride: true },
    });
    if (branchService?.journeyModeOverride)
      return this.normalizeJourneyMode(branchService.journeyModeOverride);

    const service = await tx.service.findUnique({
      where: { id: serviceId, orgId },
      select: { journeyModeOverride: true },
    });
    if (service?.journeyModeOverride) return this.normalizeJourneyMode(service.journeyModeOverride);

    const branch = await tx.branch.findUnique({
      where: { id: branchId, orgId },
      select: { defaultJourneyMode: true },
    });
    return this.normalizeJourneyMode(branch?.defaultJourneyMode ?? 'single_ticket');
  }

  async resolveQueueCallingPolicy(
    db: Prisma.TransactionClient | PrismaService,
    orgId: string,
    queueId: string,
  ): Promise<QueueCallingPolicy> {
    const queue = await db.queue.findUnique({
      where: { id: queueId, orgId },
      select: { callingPolicy: true, stepRole: true, flowTemplateId: true },
    });
    if (!queue) return 'fifo';

    if (queue.flowTemplateId) {
      const flowStep = await db.branchFlowStep.findFirst({
        where: { orgId, templateId: queue.flowTemplateId, queueId },
        select: { callingPolicy: true, stepRole: true },
      });
      if (flowStep) {
        return resolveCallingPolicyForStep(flowStep.stepRole, flowStep.callingPolicy);
      }
    }

    return resolveCallingPolicyForStep(queue.stepRole, queue.callingPolicy);
  }

  async reserveQueueDisplayNumber(
    tx: Prisma.TransactionClient,
    orgId: string,
    queueId: string,
    opts?: { enforceOpenForNonStaff?: boolean; source?: string },
  ): Promise<{ displayNumber: string; status: string }> {
    const [queue] = await tx.$queryRaw<
      Array<{
        prefix: string;
        status: string;
        nextTicketSeq: number;
        sessionClosesAt: Date | null;
      }>
    >(Prisma.sql`
            SELECT
                prefix,
                status,
                next_ticket_seq AS "nextTicketSeq",
                session_closes_at AS "sessionClosesAt"
            FROM queues
            WHERE id = ${queueId}::uuid AND org_id = ${orgId}::uuid
            FOR UPDATE
        `);

    if (!queue) {
      throw new NotFoundException('Queue not found');
    }

    if (opts?.enforceOpenForNonStaff && queue.status !== 'open') {
      throw new BadRequestException(
        queue.status === 'closed'
          ? 'Queue is closed. Reopen the queue before issuing tickets.'
          : `Queue is not open (status: ${queue.status})`,
      );
    }

    const now = new Date();
    const sessionHours = this.getQueueSessionFallbackHours();
    const sessionExpired =
      !queue.sessionClosesAt ||
      queue.sessionClosesAt.getTime() <= now.getTime() ||
      queue.nextTicketSeq < 1;

    const seq = sessionExpired ? 1 : queue.nextTicketSeq;
    const nextClosesAt = new Date(now.getTime() + sessionHours * 60 * 60 * 1000);

    await tx.queue.update({
      where: { id: queueId },
      data: sessionExpired
        ? {
            nextTicketSeq: 2,
            sessionOpenedAt: now,
            sessionClosesAt: nextClosesAt,
          }
        : {
            nextTicketSeq: { increment: 1 },
          },
    });

    return {
      status: queue.status,
      displayNumber: this.formatDisplayNumber(queue.prefix, seq),
    };
  }
}
