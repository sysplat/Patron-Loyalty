import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { userIsOrganizationOwner } from '../../common/rbac/org-owner.util';
import { AuditService } from '../../common/audit/audit.service';
import {
  liveQueueBookedAtFloor,
  priorSessionWaitingTicketWhere,
} from '../../common/live-queue-session';
import { resolveBranchIanaZone } from '../../common/resolve-effective-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const ACTIVE_QUEUE_STATUSES = ['waiting', 'called', 'serving'] as const;

export type TicketComplianceSideEffects = {
  invalidateDerivedStats: (orgId: string, branchId: string, queueIds: string[]) => Promise<void>;
  publishMany: (events: Array<{ channel: string; event: string; data: unknown }>) => Promise<void>;
  refreshVisitStatus: (orgId: string, visitId?: string | null) => Promise<void>;
};

@Injectable()
export class TicketComplianceService {
  private readonly logger = new Logger(TicketComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async anonymizeHistoricalPii(
    retentionDays: number,
    dryRun = false,
  ): Promise<{ affected: number; dryRun: boolean; cutoffIso: string }> {
    const safeRetentionDays = Math.max(1, Math.floor(retentionDays));
    const cutoff = new Date(Date.now() - safeRetentionDays * 24 * 60 * 60 * 1000);
    const where: Prisma.TicketWhereInput = {
      legalHold: false,
      status: { in: ['completed', 'no_show', 'cancelled'] },
      bookedAt: { lt: cutoff },
      OR: [
        { customerName: { not: null } },
        { customerPhone: { not: null } },
        { customerEmail: { not: null } },
        { note: { not: null } },
      ],
    };

    if (dryRun) {
      const affected = await this.prisma.withBypassRls((tx) => tx.ticket.count({ where }));
      return { affected, dryRun: true, cutoffIso: cutoff.toISOString() };
    }

    const stale = await this.prisma.withBypassRls((tx) =>
      tx.ticket.findMany({
        where,
        select: { id: true, orgId: true },
      }),
    );

    if (stale.length === 0) {
      return { affected: 0, dryRun: false, cutoffIso: cutoff.toISOString() };
    }

    const staleByOrgId = new Map<string, string[]>();
    for (const t of stale) {
      if (!t.orgId) continue;
      let ids = staleByOrgId.get(t.orgId);
      if (!ids) {
        ids = [];
        staleByOrgId.set(t.orgId, ids);
      }
      ids.push(t.id);
    }

    let affected = 0;
    const batchSize = 100;

    for (const [orgId, ids] of staleByOrgId.entries()) {
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const res = await this.prisma.withTenant(orgId, (tx) =>
          tx.ticket.updateMany({
            where: { id: { in: batchIds } },
            data: {
              customerName: 'Anonymized Client',
              customerPhone: null,
              customerEmail: null,
              note: null,
              metadata: Prisma.JsonNull,
            },
          }),
        );
        affected += res.count;
      }
    }

    return { affected, dryRun: false, cutoffIso: cutoff.toISOString() };
  }

  async anonymizeCustomerDataByIdentifier(
    orgId: string,
    input: { customerId?: string; phone?: string; email?: string; dryRun?: boolean },
  ): Promise<{ customerCount: number; ticketCount: number; dryRun: boolean }> {
    const whereCustomer: Prisma.CustomerWhereInput = {
      orgId,
      ...(input.customerId ? { id: input.customerId } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.email ? { email: input.email } : {}),
    };
    return this.prisma.withTenant(orgId, async (tx) => {
      const customers = await tx.customer.findMany({
        where: whereCustomer,
        select: { id: true },
      });
      if (customers.length === 0) {
        throw new NotFoundException('No matching customer records found');
      }
      const customerIds = customers.map((c) => c.id);
      const ticketWhere: Prisma.TicketWhereInput = {
        orgId,
        customerId: { in: customerIds },
        legalHold: false,
      };

      if (input.dryRun) {
        const ticketCount = await tx.ticket.count({ where: ticketWhere });
        return { customerCount: customers.length, ticketCount, dryRun: true };
      }

      const [ticketResult] = await Promise.all([
        tx.ticket.updateMany({
          where: ticketWhere,
          data: {
            customerName: 'Anonymized Client',
            customerPhone: null,
            customerEmail: null,
            note: null,
            metadata: Prisma.JsonNull,
            transactionalSmsAllowed: false,
          },
        }),
        tx.customer.updateMany({
          where: { id: { in: customerIds }, orgId },
          data: {
            name: 'Anonymized Client',
            phone: null,
            email: null,
            metadata: Prisma.JsonNull,
            transactionalSmsAllowed: false,
          },
        }),
      ]);

      return {
        customerCount: customers.length,
        ticketCount: ticketResult.count,
        dryRun: false,
      };
    });
  }

  private async assertOrgOwnerForHistoryDelete(orgId: string, actorUserId: string): Promise<void> {
    const isOwner = await userIsOrganizationOwner(this.prisma, orgId, actorUserId);
    if (!isOwner) {
      throw new ForbiddenException(
        'Only the organization owner may delete ticket history records.',
      );
    }
  }

  private assertTicketDeletableFromHistory(ticket: { status: string; legalHold: boolean }): void {
    if (ticket.legalHold) {
      throw new BadRequestException('This ticket is on legal hold and cannot be deleted.');
    }
    if ((ACTIVE_QUEUE_STATUSES as readonly string[]).includes(ticket.status)) {
      throw new BadRequestException(
        'Active queue tickets cannot be deleted from history. Cancel or complete the ticket first.',
      );
    }
  }

  private async emitTicketDeletedSideEffects(
    sideEffects: TicketComplianceSideEffects,
    orgId: string,
    ticket: {
      branchId: string;
      queueId: string;
      visitId: string | null;
      displayNumber?: string | null;
    },
    ticketId: string,
    actorUserId: string,
    options?: { skipInvalidateStats?: boolean },
  ): Promise<void> {
    sideEffects
      .publishMany([
        { channel: `queue:${ticket.queueId}`, event: 'ticket.deleted', data: { ticketId } },
        { channel: `display:${ticket.branchId}`, event: 'ticket.deleted', data: { ticketId } },
        { channel: `org:${orgId}`, event: 'ticket.deleted', data: { ticketId } },
      ])
      .catch(() => undefined);

    if (!options?.skipInvalidateStats) {
      await sideEffects.invalidateDerivedStats(orgId, ticket.branchId, [ticket.queueId]);
    }
    await this.redis.del(`cache:ticket-public:${ticketId}`).catch(() => undefined);
    await sideEffects.refreshVisitStatus(orgId, ticket.visitId).catch(() => undefined);

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'ticket.history_deleted',
      resourceType: 'ticket',
      resourceId: ticketId,
      metadata: { displayNumber: ticket.displayNumber ?? null },
    });
  }

  async deleteHistoryTicket(
    sideEffects: TicketComplianceSideEffects,
    orgId: string,
    actorUserId: string,
    ticketId: string,
  ) {
    await this.assertOrgOwnerForHistoryDelete(orgId, actorUserId);

    const ticket = await this.prisma.withTenant(orgId, async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, orgId },
        select: {
          id: true,
          orgId: true,
          branchId: true,
          queueId: true,
          visitId: true,
          status: true,
          legalHold: true,
          displayNumber: true,
        },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      this.assertTicketDeletableFromHistory(ticket);

      await tx.ticket.delete({ where: { id: ticketId } });
      return ticket;
    });

    await this.emitTicketDeletedSideEffects(sideEffects, orgId, ticket, ticketId, actorUserId);

    return { deleted: true, id: ticketId };
  }

  async deleteHistoryTicketsBulk(
    sideEffects: TicketComplianceSideEffects,
    orgId: string,
    actorUserId: string,
    ticketIds: string[],
  ) {
    await this.assertOrgOwnerForHistoryDelete(orgId, actorUserId);

    const uniqueIds = [...new Set(ticketIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('At least one ticket id is required.');
    }
    if (uniqueIds.length > 200) {
      throw new BadRequestException('Cannot delete more than 200 tickets at once.');
    }

    const { deletable, blocked, notFound } = await this.prisma.withTenant(orgId, async (tx) => {
      const tickets = await tx.ticket.findMany({
        where: { orgId, id: { in: uniqueIds } },
        select: {
          id: true,
          branchId: true,
          queueId: true,
          visitId: true,
          status: true,
          legalHold: true,
          displayNumber: true,
        },
      });

      const foundIds = new Set(tickets.map((t) => t.id));
      const notFound = uniqueIds.filter((id) => !foundIds.has(id));

      const blocked: Array<{ id: string; reason: string }> = [];
      const deletable: typeof tickets = [];
      for (const ticket of tickets) {
        try {
          this.assertTicketDeletableFromHistory(ticket);
          deletable.push(ticket);
        } catch (err) {
          blocked.push({
            id: ticket.id,
            reason: err instanceof BadRequestException ? err.message : 'Cannot delete this ticket.',
          });
        }
      }

      if (deletable.length > 0) {
        await tx.ticket.deleteMany({
          where: { orgId, id: { in: deletable.map((t) => t.id) } },
        });
      }

      return { deletable, blocked, notFound };
    });

    const branchQueues = new Map<string, Set<string>>();
    for (const ticket of deletable) {
      if (!branchQueues.has(ticket.branchId)) branchQueues.set(ticket.branchId, new Set());
      branchQueues.get(ticket.branchId)!.add(ticket.queueId);
    }
    await Promise.all(
      [...branchQueues.entries()].map(([branchId, queueIds]) =>
        sideEffects.invalidateDerivedStats(orgId, branchId, [...queueIds]),
      ),
    );

    const batchSize = 15;
    for (let i = 0; i < deletable.length; i += batchSize) {
      const batch = deletable.slice(i, i + batchSize);
      await Promise.all(
        batch.map((ticket) =>
          this.emitTicketDeletedSideEffects(sideEffects, orgId, ticket, ticket.id, actorUserId, {
            skipInvalidateStats: true,
          }),
        ),
      );
    }

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'ticket.history_deleted_bulk',
      resourceType: 'ticket',
      metadata: {
        requested: uniqueIds.length,
        deleted: deletable.length,
        blocked: blocked.length,
        notFound: notFound.length,
      },
    });

    return {
      requested: uniqueIds.length,
      deleted: deletable.length,
      blocked,
      notFound,
    };
  }

  async expireStaleTickets(
    sideEffects: Pick<TicketComplianceSideEffects, 'invalidateDerivedStats'>,
    thresholdMinutes = 120,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    const now = new Date();

    const stale = await this.prisma.withBypassRls((tx) =>
      tx.ticket.findMany({
        where: {
          status: { in: ['called', 'serving'] },
          calledAt: { lt: cutoff },
        },
        select: {
          id: true,
          orgId: true,
          queueId: true,
          branchId: true,
          bookedAt: true,
          calledAt: true,
          servedAt: true,
        },
      }),
    );

    if (stale.length === 0) return 0;

    const batchSize = 15;
    for (let i = 0; i < stale.length; i += batchSize) {
      const batch = stale.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (t) => {
          const servedAt = t.servedAt ?? t.calledAt ?? now;
          const waitMinutes = Math.max(0, (servedAt.getTime() - t.bookedAt.getTime()) / 60000);
          const serviceMinutes = Math.max(0, (now.getTime() - servedAt.getTime()) / 60000);

          await this.prisma.withTenant(t.orgId, (tx) =>
            tx.ticket.update({
              where: { id: t.id },
              data: {
                status: 'no_show',
                completedAt: now,
                servedAt: t.servedAt ?? servedAt,
                waitMinutes,
                serviceMinutes,
              },
            }),
          );
        }),
      );
    }

    const uniquePairs = [
      ...new Map(stale.map((t) => [`${t.orgId}:${t.queueId}:${t.branchId}`, t])).values(),
    ];
    await Promise.allSettled(
      uniquePairs.map((t) => sideEffects.invalidateDerivedStats(t.orgId, t.branchId, [t.queueId])),
    );

    this.logger.warn(
      `Auto-expired ${stale.length} stale ticket(s) older than ${thresholdMinutes} min`,
    );
    return stale.length;
  }

  /**
   * Marks prior-branch-day `waiting` tickets as no-show (before today's midnight in branch time).
   * Keeps queue cards, public track position, and agent consoles aligned with today's session.
   */
  async closePriorSessionWaitingTickets(
    sideEffects: Pick<
      TicketComplianceSideEffects,
      'invalidateDerivedStats' | 'publishMany' | 'refreshVisitStatus'
    >,
    options: { dryRun?: boolean; orgId?: string; branchId?: string } = {},
  ): Promise<{ closed: number; dryRun: boolean }> {
    const dryRun = options.dryRun ?? false;
    const now = new Date();

    const branches = await this.prisma.withBypassRls(async (tx) =>
      tx.branch.findMany({
        where: {
          ...(options.orgId ? { orgId: options.orgId } : {}),
          ...(options.branchId ? { id: options.branchId } : {}),
        },
        select: { id: true, orgId: true },
      }),
    );

    let closed = 0;
    const invalidatePairs = new Map<string, { orgId: string; branchId: string; queueId: string }>();

    for (const branch of branches) {
      const tz = await resolveBranchIanaZone(this.prisma, branch.orgId, branch.id, this.redis);
      const floor = liveQueueBookedAtFloor(tz, 0);
      const where = priorSessionWaitingTicketWhere(branch.id, floor);

      if (dryRun) {
        const count = await this.prisma.withTenant(branch.orgId, (tx) =>
          tx.ticket.count({ where }),
        );
        closed += count;
        continue;
      }

      const staleRows = await this.prisma.withTenant(branch.orgId, async (tx) => {
        const rows = await tx.ticket.findMany({
          where,
          select: { id: true, queueId: true, visitId: true },
        });
        if (rows.length === 0) return [];

        await tx.ticket.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: {
            status: 'no_show',
            completedAt: now,
          },
        });
        return rows;
      });

      closed += staleRows.length;
      for (const row of staleRows) {
        invalidatePairs.set(`${branch.orgId}:${row.queueId}`, {
          orgId: branch.orgId,
          branchId: branch.id,
          queueId: row.queueId,
        });
      }

      if (staleRows.length > 0) {
        await sideEffects.publishMany(
          staleRows.map((row) => ({
            channel: `queue:${row.queueId}`,
            event: 'ticket.no_show',
            data: { id: row.id, queueId: row.queueId, status: 'no_show' },
          })),
        );
        const visitIds = [
          ...new Set(staleRows.map((row) => row.visitId).filter((id): id is string => !!id)),
        ];
        await Promise.allSettled(
          visitIds.map((visitId) => sideEffects.refreshVisitStatus(branch.orgId, visitId)),
        );
      }
    }

    await Promise.allSettled(
      [...invalidatePairs.values()].map((p) =>
        sideEffects.invalidateDerivedStats(p.orgId, p.branchId, [p.queueId]),
      ),
    );

    if (!dryRun && closed > 0) {
      this.logger.log(`Marked ${closed} prior-session waiting ticket(s) as no-show`);
    }

    return { closed, dryRun };
  }
}
