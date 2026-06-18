import { Body, Controller, Delete, Get, Param, Post, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { StationProfileService, type CreateStationProfileInput } from './station-profile.service';
import { CreateStationProfileDto, UpdateStationProfileDto } from './dto/workbench.dto';

@ApiTags('Station profiles')
@ApiBearerAuth()
@Controller({ path: 'station-profiles', version: '1' })
export class StationProfileController {
  constructor(private readonly stationProfileService: StationProfileService) {}

  @Get()
  @ApiOperation({ summary: 'List station profiles' })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'station_profile', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string) {
    const data = await this.stationProfileService.list(user.orgId, user.userId, branchId);
    return { success: true, data };
  }

  @Post('from-flow/:templateId')
  @ApiOperation({ summary: 'Create default station profiles from a flow template' })
  @ApiQuery({ name: 'branchId', required: true })
  /** Same privilege as activating a flow — branch queue configuration, not frontline staff work. */
  @RequirePermissions({ resource: 'queue', action: 'update' })
  async generateFromFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('templateId') templateId: string,
    @Query('branchId') branchId: string,
  ) {
    const data = await this.stationProfileService.generateFromFlowTemplate(
      user.orgId,
      user.userId,
      templateId,
      branchId,
    );
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get station profile' })
  @RequirePermissions({ resource: 'station_profile', action: 'read' })
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.stationProfileService.getById(user.orgId, user.userId, id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create station profile' })
  @RequirePermissions({ resource: 'station_profile', action: 'create' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateStationProfileDto) {
    const data = await this.stationProfileService.create(
      user.orgId,
      user.userId,
      body as CreateStationProfileInput,
    );
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update station profile' })
  @RequirePermissions({ resource: 'station_profile', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateStationProfileDto,
  ) {
    const data = await this.stationProfileService.update(
      user.orgId,
      user.userId,
      id,
      body as Partial<CreateStationProfileInput>,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete station profile' })
  @RequirePermissions({ resource: 'station_profile', action: 'delete' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.stationProfileService.delete(user.orgId, user.userId, id);
    return { success: true };
  }
}
