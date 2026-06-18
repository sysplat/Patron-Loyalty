import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CUSTOMER_SEGMENT_PRESET_VALUES, type CustomerSegmentPreset } from '@queueplatform/shared';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { CustomerService } from './customer.service';
import { CreateCustomerSegmentDto, CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('segments/presets')
  @ApiOperation({ summary: 'List built-in patron CRM segment presets' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listPresetSegments() {
    return this.customerService.listPresetSegments();
  }

  @Get('segments')
  @ApiOperation({ summary: 'List saved patron CRM segments' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listSavedSegments(@CurrentUser() user: AuthenticatedUser) {
    return this.customerService.listSavedSegments(user.orgId);
  }

  @Post('segments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save a patron CRM segment filter' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createSavedSegment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCustomerSegmentDto,
  ) {
    const presetRaw = body.filters.preset;
    const preset =
      presetRaw && CUSTOMER_SEGMENT_PRESET_VALUES.includes(presetRaw as CustomerSegmentPreset)
        ? (presetRaw as CustomerSegmentPreset)
        : undefined;
    return this.customerService.createSavedSegment(user.orgId, {
      name: body.name,
      filters: {
        branchId: body.filters.branchId,
        search: body.filters.search,
        preset,
      },
    });
  }

  @Delete('segments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a saved patron CRM segment' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async deleteSavedSegment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.customerService.deleteSavedSegment(user.orgId, id);
  }

  @Get()
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'List patrons (customer directory)' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'segment', required: false, enum: CUSTOMER_SEGMENT_PRESET_VALUES })
  @ApiQuery({ name: 'savedSegmentId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('segment') segment?: (typeof CUSTOMER_SEGMENT_PRESET_VALUES)[number],
    @Query('savedSegmentId') savedSegmentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customerService.listForPrincipal(user.orgId, user.userId, {
      branchId,
      search,
      segment,
      savedSegmentId,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a patron manually (loyalty / CRM)' })
  @RequirePermissions({ resource: 'customer', action: 'create' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCustomerDto) {
    return this.customerService.create(user.orgId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patron profile with unified timeline' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customerService.getByIdForPrincipal(user.orgId, user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patron tags, notes, or name' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCustomerDto,
  ) {
    return this.customerService.update(user.orgId, id, body);
  }
}
