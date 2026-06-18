import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { PlatformDataService } from './platform-data.service';
import { PlatformDataPurgeDto, PlatformDataPurgeDryRunDto } from './dto/platform.dto';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/data', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformDataController {
  constructor(private readonly data: PlatformDataService) {}

  @Post('export-jobs')
  @ApiOperation({ summary: 'Request anonymized aggregate export job' })
  async createExport(@CurrentUser() user: AuthenticatedUser) {
    const job = await this.data.createExportJob(user.userId);
    return { success: true, data: job };
  }

  @Get('export-jobs/:id')
  @ApiOperation({ summary: 'Get export job status (pending jobs are processed on first read)' })
  async getExport(@Param('id') id: string) {
    await this.data.processExportJobIfPending(id);
    const job = await this.data.getExportJob(id);
    return { success: true, data: job };
  }

  @Post('purge-dry-run')
  @ApiOperation({ summary: 'Dry-run counts for purging an organization (destructive)' })
  async purgeDryRun(@Body() body: PlatformDataPurgeDryRunDto) {
    const data = await this.data.purgeDryRun(body.orgId);
    return { success: true, data };
  }

  @Post('purge-execute')
  @ApiOperation({
    summary:
      'Permanently delete an organization — confirmation must equal organization name exactly',
  })
  async purgeExecute(@CurrentUser() user: AuthenticatedUser, @Body() body: PlatformDataPurgeDto) {
    const data = await this.data.purgeExecute(user, body.orgId, body.confirmation);
    return { success: true, data };
  }
}
