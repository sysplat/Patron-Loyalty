import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AssignRoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
} from './dto/role.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller({ path: 'roles', version: '1' })
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: 'List roles' })
  @RequirePermissions({ resource: 'role', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.roleService.list(user.orgId);
    return { success: true, data };
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all available permissions' })
  @RequirePermissions({ resource: 'role', action: 'read' })
  async listPermissions() {
    const data = await this.roleService.listPermissions();
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  @RequirePermissions({ resource: 'role', action: 'read' })
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.roleService.getById(user.orgId, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create role' })
  @RequirePermissions({ resource: 'role', action: 'create' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRoleDto) {
    const data = await this.roleService.create(user.orgId, user.userId ?? user.id, body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role' })
  @RequirePermissions({ resource: 'role', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
  ) {
    const data = await this.roleService.update(user.orgId, id, user.userId ?? user.id, body);
    return { success: true, data };
  }

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Update role permissions' })
  @RequirePermissions({ resource: 'role', action: 'update' })
  async updatePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateRolePermissionsDto,
  ) {
    const data = await this.roleService.updatePermissions(
      user.orgId,
      id,
      user.userId ?? user.id,
      body.permissionIds,
    );
    return { success: true, data };
  }

  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign role to user' })
  @RequirePermissions({ resource: 'role', action: 'update' })
  async assign(@CurrentUser() user: AuthenticatedUser, @Body() body: AssignRoleDto) {
    const data = await this.roleService.assignToUser(user.orgId, user.userId ?? user.id, body);
    return { success: true, data };
  }

  @Delete('assignments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove role assignment' })
  @RequirePermissions({ resource: 'role', action: 'update' })
  async removeAssignment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.roleService.removeAssignment(user.orgId, id, user.userId ?? user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete role' })
  @RequirePermissions({ resource: 'role', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.roleService.delete(user.orgId, id, user.userId ?? user.id);
  }
}
