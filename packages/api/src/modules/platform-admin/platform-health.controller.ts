import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { PlatformHealthService } from './platform-health.service';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/health', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformHealthController {
  constructor(private readonly health: PlatformHealthService) {}

  @Get('snapshots')
  @ApiOperation({ summary: 'Latest org health snapshots (one row per org in page)' })
  async list(@Query('skip') skipRaw?: string, @Query('take') takeRaw?: string) {
    const skip = Math.max(0, parseInt(skipRaw ?? '0', 10) || 0);
    const take = Math.min(100, Math.max(1, parseInt(takeRaw ?? '30', 10) || 30));
    const data = await this.health.listLatestSnapshots(skip, take);
    return { success: true, data };
  }

  @Post('compute')
  @ApiOperation({
    summary: 'Recompute health snapshots for all organizations (sync, may take time)',
  })
  async computeNow() {
    await this.health.computeSnapshotsForAllOrgs();
    return { success: true, data: { message: 'Snapshots computed' } };
  }
}
