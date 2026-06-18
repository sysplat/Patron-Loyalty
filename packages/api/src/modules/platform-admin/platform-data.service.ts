import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';

@Injectable()
export class PlatformDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  async createExportJob(requestedById: string, type = 'ticket_volume_by_weekday_v1') {
    return this.prisma.platformExportJob.create({
      data: {
        requestedById,
        type,
        status: 'pending',
      },
    });
  }

  async getExportJob(id: string) {
    return this.prisma.platformExportJob.findUnique({ where: { id } });
  }

  /** Lazy processing: first poll transitions pending → completed with aggregate JSON in metadata. */
  async processExportJobIfPending(jobId: string): Promise<void> {
    const job = await this.prisma.platformExportJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'pending') return;

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.withBypassRls(async (tx) => {
      return tx.$queryRaw<Array<{ dow: number; count: bigint }>>(
        Prisma.sql`
                    SELECT EXTRACT(DOW FROM booked_at)::int AS dow, COUNT(*)::bigint AS count
                    FROM tickets
                    WHERE booked_at >= ${since}
                    GROUP BY 1
                    ORDER BY 1
                `,
      );
    });

    const summary = rows.map((r) => ({
      weekday: Number(r.dow),
      ticketCount: Number(r.count),
    }));

    await this.prisma.platformExportJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        metadata: {
          anonymized: true,
          window: '90d',
          aggregate: 'ticket_volume_by_weekday_utc',
          rows: summary,
        },
      },
    });
  }

  async purgeDryRun(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const [tickets, users, branches, queues] = await this.prisma.withTenant(orgId, async (tx) => {
      return Promise.all([
        tx.ticket.count({ where: { orgId } }),
        tx.user.count({ where: { orgId } }),
        tx.branch.count({ where: { orgId } }),
        tx.queue.count({ where: { orgId } }),
      ]);
    });

    return {
      organization: org,
      countsWouldDelete: { tickets, users, branches, queues },
      note: 'Executing purge deletes the organization row; PostgreSQL cascades remove dependent data.',
    };
  }

  async purgeExecute(
    actor: { userId: string; email: string },
    orgId: string,
    confirmation: string,
  ): Promise<{ deleted: boolean }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (confirmation !== org.name) {
      throw new BadRequestException('Confirmation must exactly match the organization name');
    }

    await this.prisma.organization.delete({ where: { id: orgId } });

    await this.platformAudit.log({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      eventType: 'platform.organization.purge',
      severity: 'critical',
      subjectOrgId: orgId,
      metadata: { deletedOrgName: org.name },
    });

    return { deleted: true };
  }
}
