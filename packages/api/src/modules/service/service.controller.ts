import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  BranchQueueSettingsDto,
  CreateServiceCategoryDto,
  CreateServiceDto,
  CreateSubServiceDto,
  UpdateServiceDto,
  UpdateSubServiceDto,
} from './dto/service.dto';

@ApiTags('services')
@ApiBearerAuth()
@Controller({ path: 'services', version: '1' })
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get('branch/:branchId/public')
  @Public()
  @ApiOperation({ summary: 'Public — list services for a branch' })
  async listByBranch(@Param('branchId') branchId: string) {
    const data = await this.serviceService.listByBranchPublic(branchId);
    return { success: true, data };
  }

  @Get()
  @AllowBranchScopedListRead()
  @RequirePermissions({ resource: 'service', action: 'read' })
  @ApiOperation({ summary: 'List all services' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.serviceService.listForPrincipal(
      user.orgId,
      user.userId,
      search,
      branchId,
    );
    return { success: true, data };
  }

  @Get('analytics/summary')
  @AllowBranchScopedListRead()
  @RequirePermissions({ resource: 'service', action: 'read' })
  @ApiOperation({ summary: 'Services analytics summary for current principal scope' })
  async analyticsSummary(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.serviceService.analyticsSummaryForPrincipal(user.orgId, user.userId);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions({ resource: 'service', action: 'create' })
  @ApiOperation({ summary: 'Create a new service' })
  async create(@CurrentUser('orgId') orgId: string, @Body() body: CreateServiceDto) {
    const data = await this.serviceService.create(orgId, body);
    return { success: true, data };
  }

  @Get('categories')
  @AllowBranchScopedListRead()
  @RequirePermissions({ resource: 'service', action: 'read' })
  @ApiOperation({ summary: 'List service categories' })
  async listCategories(@CurrentUser('orgId') orgId: string) {
    const data = await this.serviceService.listCategories(orgId);
    return { success: true, data };
  }

  @Post('categories')
  @RequirePermissions({ resource: 'service', action: 'create' })
  @ApiOperation({ summary: 'Create a service category' })
  async createCategory(
    @CurrentUser('orgId') orgId: string,
    @Body() body: CreateServiceCategoryDto,
  ) {
    const data = await this.serviceService.createCategory(orgId, body);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions({ resource: 'service', action: 'read' })
  @ApiOperation({ summary: 'Get service details' })
  async getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    const data = await this.serviceService.getById(orgId, id);
    return { success: true, data };
  }

  @Patch(':id/branches/:branchId/queue-settings')
  @RequirePermissions({ resource: 'service', action: 'update' })
  @ApiOperation({
    summary: 'Branch queue time estimates (optional per-branch overrides)',
    description:
      'Overrides per-turn min/max minutes for this service at the branch. Send null for both fields to clear overrides and use service defaults.',
  })
  async setBranchQueueSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') serviceId: string,
    @Param('branchId') branchId: string,
    @Body() body: BranchQueueSettingsDto,
  ) {
    const data = await this.serviceService.patchBranchQueueSettings(
      user.orgId,
      user.userId,
      serviceId,
      branchId,
      body ?? {},
    );
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'service', action: 'update' })
  @ApiOperation({ summary: 'Update a service' })
  async update(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateServiceDto,
  ) {
    const data = await this.serviceService.update(orgId, id, body as any);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'service', action: 'delete' })
  @ApiOperation({ summary: 'Delete a service' })
  async delete(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.serviceService.delete(orgId, id);
    return { success: true };
  }

  // ─── Sub-service endpoints ────────────────────────────────────────────────

  @Get(':id/sub-services/public')
  @Public()
  @ApiOperation({ summary: 'Public — list active sub-services for a service' })
  async listSubServicesPublic(@Param('id') id: string) {
    const data = await this.serviceService.listSubServicesPublic(id);
    return { success: true, data };
  }

  @Get(':id/sub-services')
  @RequirePermissions({ resource: 'service', action: 'read' })
  @ApiOperation({ summary: 'List sub-services for a service' })
  async listSubServices(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    const data = await this.serviceService.listSubServices(orgId, id);
    return { success: true, data };
  }

  @Post(':id/sub-services')
  @RequirePermissions({ resource: 'service', action: 'create' })
  @ApiOperation({ summary: 'Create a sub-service under a service' })
  async createSubService(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: CreateSubServiceDto,
  ) {
    const data = await this.serviceService.createSubService(orgId, id, body);
    return { success: true, data };
  }

  @Patch(':id/sub-services/:subId')
  @RequirePermissions({ resource: 'service', action: 'update' })
  @ApiOperation({ summary: 'Update a sub-service' })
  async updateSubService(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Param('subId') subId: string,
    @Body() body: UpdateSubServiceDto,
  ) {
    const data = await this.serviceService.updateSubService(orgId, id, subId, body);
    return { success: true, data };
  }

  @Delete(':id/sub-services/:subId')
  @RequirePermissions({ resource: 'service', action: 'delete' })
  @ApiOperation({ summary: 'Delete a sub-service' })
  async deleteSubService(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Param('subId') subId: string,
  ) {
    await this.serviceService.deleteSubService(orgId, id, subId);
    return { success: true };
  }
}
