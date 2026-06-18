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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DeskService } from './desk.service';
import { CreateDeskDto } from './dto/create-desk.dto';
import { UpdateDeskDto } from './dto/update-desk.dto';
import { AssignDeskDto } from './dto/assign-desk.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Desks')
@ApiBearerAuth()
@Controller({ path: 'desks', version: '1' })
export class DeskController {
  constructor(private readonly deskService: DeskService) {}

  @Get()
  @ApiOperation({ summary: 'List desks' })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'desk', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string) {
    const viewerUserId = user.userId ?? user.id;
    const data = await this.deskService.list(user.orgId, { branchId, viewerUserId });
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get desk by ID' })
  @RequirePermissions({ resource: 'desk', action: 'read' })
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const viewerUserId = user.userId ?? user.id;
    const data = await this.deskService.getById(user.orgId, id, viewerUserId);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create desk' })
  @RequirePermissions({ resource: 'desk', action: 'create' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateDeskDto) {
    const data = await this.deskService.create(user.orgId, body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update desk' })
  @RequirePermissions({ resource: 'desk', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateDeskDto,
  ) {
    const viewerUserId = user.userId ?? user.id;
    const data = await this.deskService.update(user.orgId, id, body, viewerUserId);
    return { success: true, data };
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign users to a desk' })
  @RequirePermissions({ resource: 'desk', action: 'update' })
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AssignDeskDto,
  ) {
    const data = await this.deskService.assign(
      user.orgId,
      user.userId ?? user.id,
      id,
      body.userIds,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete desk' })
  @RequirePermissions({ resource: 'desk', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.deskService.delete(user.orgId, id);
  }
}
