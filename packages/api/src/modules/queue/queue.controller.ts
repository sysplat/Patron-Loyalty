import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';

import { QueueUpdateDto } from './dto/queue-update.dto';
import { QueueCreateDto } from './dto/queue-create.dto';
import { StopQueueDto } from './dto/flow-template.dto';

@ApiTags('Queues')
@ApiBearerAuth()
@Controller({ path: 'queues', version: '1' })
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('branch/:branchId/public')
  @Public()
  @ApiOperation({ summary: 'Public — get open queues for a branch (no auth required)' })
  async getPublicQueues(@Param('branchId') branchId: string) {
    const { queues, showWaitEstimates, meta } = await this.queueService.getPublicQueues(branchId);
    return { success: true, data: queues, meta: { showWaitEstimates, ...meta } };
  }

  @Get()
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'List queues' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'serviceId', required: false })
  @ApiQuery({ name: 'surface', required: false, enum: ['classic', 'journey'] })
  @RequirePermissions({ resource: 'queue', action: 'read' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('surface') surface?: 'classic' | 'journey',
  ) {
    const data = await this.queueService.listForPrincipal(
      user.orgId,
      user.userId,
      branchId,
      serviceId,
      surface,
    );
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get queue by ID' })
  @RequirePermissions({ resource: 'queue', action: 'read' })
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.queueService.getById(user.orgId, id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create queue' })
  @RequirePermissions({ resource: 'queue', action: 'create' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: QueueCreateDto) {
    const data = await this.queueService.create(user.orgId, body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update queue' })
  @RequirePermissions({ resource: 'queue', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: QueueUpdateDto,
  ) {
    const data = await this.queueService.update(user.orgId, id, body);
    return { success: true, data };
  }

  @Post(':id/open')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open queue' })
  @RequirePermissions({ resource: 'queue', action: 'update' })
  async open(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.queueService.open(user.orgId, id);
    return { success: true, data };
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause queue' })
  @RequirePermissions({ resource: 'queue', action: 'update' })
  async pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.queueService.pause(user.orgId, id);
    return { success: true, data };
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close queue' })
  @RequirePermissions({ resource: 'queue', action: 'update' })
  async close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: StopQueueDto,
  ) {
    const data = await this.queueService.close(user.orgId, id, user.userId, body);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete queue' })
  @RequirePermissions({ resource: 'queue', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.queueService.delete(user.orgId, id);
  }
}
