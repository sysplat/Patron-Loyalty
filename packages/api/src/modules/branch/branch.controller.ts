import { Controller, Get, Post, Patch, Delete, Param, Body, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreateBranchDto,
  SetWorkingHoursDto,
  UpdateBranchCustomerNoticeDto,
  UpdateBranchDto,
  UpsertDateOverrideDto,
} from './dto/branch.dto';

@ApiTags('branches')
@ApiBearerAuth()
@Controller({ path: 'branches', version: '1' })
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @AllowBranchScopedListRead()
  @RequirePermissions({ resource: 'branch', action: 'read' })
  @ApiOperation({ summary: 'List all branches' })
  async list(@CurrentUser() user: { orgId: string; userId?: string; id?: string }) {
    const userId = user.userId ?? user.id;
    if (!userId) throw new Error('User id required');
    const data = await this.branchService.listForPrincipal(user.orgId, userId);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions({ resource: 'branch', action: 'create' })
  @ApiOperation({ summary: 'Create a new branch' })
  async create(@CurrentUser('orgId') orgId: string, @Body() body: CreateBranchDto) {
    const data = await this.branchService.create(orgId, body);
    return { success: true, data };
  }

  @Get(':id/public')
  @Public()
  @ApiOperation({ summary: 'Get public branch info (no auth required)' })
  async getPublic(@Param('id') id: string) {
    const data = await this.branchService.getPublicById(id);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions({ resource: 'branch', action: 'read' })
  @ApiOperation({ summary: 'Get branch details' })
  async getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    const data = await this.branchService.getById(orgId, id);
    return { success: true, data };
  }

  @Patch(':id/customer-notice')
  @RequirePermissions({ resource: 'queue', action: 'update' })
  @ApiOperation({
    summary: 'Update branch waiting-room notice buffer (serve operators)',
  })
  async updateCustomerNotice(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateBranchCustomerNoticeDto,
  ) {
    const data = await this.branchService.updateCustomerNotice(orgId, id, body);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'branch', action: 'update' })
  @ApiOperation({ summary: 'Update a branch' })
  async update(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
  ) {
    const data = await this.branchService.update(orgId, id, body);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'branch', action: 'delete' })
  @ApiOperation({ summary: 'Delete a branch' })
  async delete(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.branchService.delete(orgId, id);
    return { success: true };
  }

  @Get(':id/working-hours')
  @RequirePermissions({ resource: 'branch', action: 'read' })
  @ApiOperation({ summary: 'Get branch working hours' })
  async getWorkingHours(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    const data = await this.branchService.getWorkingHours(orgId, id);
    return { success: true, data };
  }

  @Put(':id/working-hours')
  @RequirePermissions({ resource: 'branch', action: 'update' })
  @ApiOperation({ summary: 'Set branch working hours' })
  async setWorkingHours(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: SetWorkingHoursDto,
  ) {
    const data = await this.branchService.setWorkingHours(orgId, id, body.hours);
    return { success: true, data };
  }

  @Get(':id/date-overrides')
  @RequirePermissions({ resource: 'branch', action: 'read' })
  @ApiOperation({ summary: 'Get exact-date schedule overrides for a branch' })
  async getDateOverrides(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    const data = await this.branchService.getDateOverrides(orgId, id);
    return { success: true, data };
  }

  @Post(':id/date-overrides')
  @RequirePermissions({ resource: 'branch', action: 'update' })
  @ApiOperation({ summary: 'Create or update a branch date-specific schedule override' })
  async upsertDateOverride(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpsertDateOverrideDto,
  ) {
    const data = await this.branchService.upsertDateOverride(orgId, id, body);
    return { success: true, data };
  }

  @Delete(':id/date-overrides/:overrideId')
  @RequirePermissions({ resource: 'branch', action: 'update' })
  @ApiOperation({ summary: 'Delete a branch date-specific schedule override' })
  async deleteDateOverride(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Param('overrideId') overrideId: string,
  ) {
    await this.branchService.deleteDateOverride(orgId, id, overrideId);
    return { success: true };
  }
}
