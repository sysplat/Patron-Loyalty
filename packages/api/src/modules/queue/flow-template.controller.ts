import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { FlowTemplateService } from './flow-template.service';
import { CreateFlowTemplateDto, UpdateFlowTemplateDto } from './dto/flow-template.dto';

@ApiTags('Flow templates')
@ApiBearerAuth()
@Controller({ path: 'flow-templates', version: '1' })
export class FlowTemplateController {
  constructor(private readonly flowTemplateService: FlowTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List flow templates for a branch' })
  @ApiQuery({ name: 'branchId', required: true })
  @RequirePermissions({ resource: 'queue', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    const data = await this.flowTemplateService.list(user.orgId, user.userId, branchId);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create flow template' })
  @RequirePermissions({ resource: 'queue', action: 'create' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFlowTemplateDto) {
    const data = await this.flowTemplateService.create(user.orgId, user.userId, body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update flow template' })
  @RequirePermissions({ resource: 'queue', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateFlowTemplateDto,
  ) {
    const data = await this.flowTemplateService.update(user.orgId, user.userId, id, body);
    return { success: true, data };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate branch flow template' })
  @RequirePermissions({ resource: 'queue', action: 'update' })
  async activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.flowTemplateService.activate(user.orgId, user.userId, id, user.userId);
    return { success: true, data };
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate branch flow template' })
  @RequirePermissions({ resource: 'queue', action: 'update' })
  async deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.flowTemplateService.deactivate(user.orgId, user.userId, id);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete flow template' })
  @RequirePermissions({ resource: 'queue', action: 'delete' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.flowTemplateService.remove(user.orgId, user.userId, id);
    return { success: true };
  }
}
