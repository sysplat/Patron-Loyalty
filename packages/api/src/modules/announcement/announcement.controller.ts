import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DisplayAuthGuard } from '../../common/guards/display-auth.guard';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller({ path: 'announcements', version: '1' })
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Get()
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'List all announcements for org' })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'announcement', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string) {
    const data = await this.announcementService.listForPrincipal(user.orgId, user.userId, branchId);
    return { success: true, data };
  }

  @Get('analytics/summary')
  @AllowBranchScopedListRead()
  @ApiOperation({
    summary:
      'Announcement analytics (counts by type, branch, display flag) for a created-at range in the organization timezone',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: true,
    description: 'ISO yyyy-mm-dd (organization timezone calendar day)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: true,
    description: 'ISO yyyy-mm-dd inclusive (organization timezone)',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Limit to branch + org-wide announcements',
  })
  @RequirePermissions({ resource: 'announcement', action: 'read' })
  async analyticsSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }
    const data = await this.announcementService.getAnalyticsSummaryForPrincipal(
      user.orgId,
      user.userId,
      {
        dateFrom: dateFrom.trim(),
        dateTo: dateTo.trim(),
        branchId,
      },
    );
    return { success: true, data };
  }

  @Get('display')
  @Public()
  @UseGuards(DisplayAuthGuard)
  @ApiOperation({ summary: 'Get active announcements for an authorized display screen' })
  async listActive(@Req() req: Request & { displayDevice?: any }) {
    const data = await this.announcementService.listActive(
      req.displayDevice.orgId,
      req.displayDevice.branchId,
    );
    return { success: true, data };
  }

  @Get('feed')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Unified announcement feed for the signed-in user' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'channel', required: false, enum: ['dashboard'] })
  @RequirePermissions({ resource: 'announcement', action: 'read' })
  async unifiedFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('channel') channel?: string,
  ) {
    if (channel && channel !== 'dashboard') {
      throw new BadRequestException('channel must be dashboard');
    }
    const data = await this.announcementService.getUnifiedFeedForPrincipal(
      user.orgId,
      user.userId,
      {
        branchId,
        channel: channel as 'dashboard' | undefined,
      },
    );
    return { success: true, data };
  }

  @Post(':sourceType/:id/dismiss')
  @ApiOperation({ summary: 'Dismiss an announcement for the current user' })
  @RequirePermissions({ resource: 'announcement', action: 'read' })
  async dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sourceType') sourceType: string,
    @Param('id') id: string,
  ) {
    if (sourceType !== 'platform' && sourceType !== 'org') {
      throw new BadRequestException('sourceType must be platform or org');
    }
    const data = await this.announcementService.dismissForPrincipal(
      user.orgId,
      user.userId,
      sourceType as 'platform' | 'org',
      id,
    );
    return { success: true, data };
  }

  @Post(':sourceType/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an announcement for the current user' })
  @RequirePermissions({ resource: 'announcement', action: 'read' })
  async acknowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sourceType') sourceType: string,
    @Param('id') id: string,
  ) {
    if (sourceType !== 'platform' && sourceType !== 'org') {
      throw new BadRequestException('sourceType must be platform or org');
    }
    const data = await this.announcementService.acknowledgeForPrincipal(
      user.orgId,
      user.userId,
      sourceType as 'platform' | 'org',
      id,
    );
    return { success: true, data };
  }

  @Get(':id/compliance')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Compliance stats for an organization announcement' })
  @RequirePermissions({ resource: 'announcement', action: 'read' })
  async compliance(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.announcementService.getComplianceForPrincipal(
      user.orgId,
      user.userId,
      id,
    );
    return { success: true, data };
  }

  @Get(':id')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Get announcement by ID' })
  @RequirePermissions({ resource: 'announcement', action: 'read' })
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.announcementService.getByIdForPrincipal(user.orgId, user.userId, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create announcement' })
  @RequirePermissions({ resource: 'announcement', action: 'create' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAnnouncementDto) {
    const data = await this.announcementService.create(user.orgId, body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update announcement' })
  @RequirePermissions({ resource: 'announcement', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateAnnouncementDto,
  ) {
    const data = await this.announcementService.update(user.orgId, id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete announcement' })
  @RequirePermissions({ resource: 'announcement', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.announcementService.delete(user.orgId, id);
  }
}
