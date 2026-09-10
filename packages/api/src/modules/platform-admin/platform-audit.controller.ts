import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/audit', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('events')
  @ApiOperation({
    summary: 'Global platform audit feed (filter by event type, org, actor, severity, date)',
  })
  async listEvents(
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
    @Query('eventType') eventType?: string,
    @Query('subjectOrgId') subjectOrgId?: string,
    @Query('actorEmail') actorEmail?: string,
    @Query('severity') severity?: string,
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
  ) {
    const skip = Math.max(0, parseInt(skipRaw ?? '0', 10) || 0);
    const take = Math.min(200, Math.max(1, parseInt(takeRaw ?? '50', 10) || 50));

    const where: Prisma.PlatformAuditEventWhereInput = {};
    if (eventType?.trim()) {
      const et = eventType.trim();
      // Trailing `*` = prefix match (e.g. auth.*) for auth incident timelines.
      if (et.endsWith('*')) {
        where.eventType = { startsWith: et.slice(0, -1), mode: 'insensitive' };
      } else {
        // Exact match (case-insensitive) so filters stay precise for counsel/incidents.
        where.eventType = { equals: et, mode: 'insensitive' };
      }
    }
    if (subjectOrgId?.trim()) {
      const orgId = subjectOrgId.trim();
      if (!UUID_RE.test(orgId)) {
        throw new BadRequestException('subjectOrgId must be a valid UUID');
      }
      where.subjectOrgId = orgId;
    }
    if (actorEmail?.trim()) {
      // Prefix match so (actorEmail, createdAt) btree indexes can be used; paste full email for exact.
      const email = actorEmail.trim().toLowerCase();
      where.actorEmail = { startsWith: email, mode: 'insensitive' };
    }
    if (severity?.trim()) {
      where.severity = severity.trim().toLowerCase();
    }
    const from = fromRaw?.trim() ? new Date(fromRaw.trim()) : null;
    const to = toRaw?.trim() ? new Date(toRaw.trim()) : null;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      where.createdAt = {};
      if (from && !Number.isNaN(from.getTime())) {
        where.createdAt.gte = from;
      }
      if (to && !Number.isNaN(to.getTime())) {
        where.createdAt.lte = to;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.platformAuditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.platformAuditEvent.count({ where }),
    ]);
    return { success: true, data: { items, skip, take, total } };
  }
}
