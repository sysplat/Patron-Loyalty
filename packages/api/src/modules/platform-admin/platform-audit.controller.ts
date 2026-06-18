import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/audit', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('events')
  @ApiOperation({ summary: 'Global platform audit feed (high-priority events)' })
  async listEvents(
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
    @Query('eventType') eventType?: string,
  ) {
    const skip = Math.max(0, parseInt(skipRaw ?? '0', 10) || 0);
    const take = Math.min(200, Math.max(1, parseInt(takeRaw ?? '50', 10) || 50));
    const where = eventType ? { eventType } : {};
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
