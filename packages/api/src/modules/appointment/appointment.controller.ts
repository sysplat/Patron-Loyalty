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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AppointmentService } from './appointment.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/appointment-query.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AppointmentFeatureGuard, SkipAppointmentFeatureGuard } from './appointment-feature.guard';
import { UseGuards } from '@nestjs/common';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller({ path: 'appointments', version: '1' })
@UseGuards(AppointmentFeatureGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}
  private static readonly PUBLIC_LOOKUP_THROTTLE = { medium: { limit: 6, ttl: 60_000 } };
  private static readonly PUBLIC_MUTATION_THROTTLE = { medium: { limit: 10, ttl: 60_000 } };

  @Get()
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'List appointments' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'serviceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'When used with `to`, yyyy-mm-dd bounds interpreted in the organization timezone',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description:
      'When used with `from`, yyyy-mm-dd bounds interpreted in the organization timezone',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive match on customer name, email, or phone',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @RequirePermissions({ resource: 'appointment', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAppointmentsQueryDto) {
    const data = await this.appointmentService.listForPrincipal(user.orgId, user.userId, {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    return { success: true, data };
  }

  @Get('analytics/summary')
  @AllowBranchScopedListRead()
  @ApiOperation({
    summary:
      'Appointment analytics — counts by status, branch, and service for scheduled time in an organization-local date range',
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
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'serviceId', required: false })
  @RequirePermissions({ resource: 'appointment', action: 'read' })
  async analyticsSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('branchId') branchId?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }
    const data = await this.appointmentService.getAnalyticsSummaryForPrincipal(
      user.orgId,
      user.userId,
      {
        dateFrom: dateFrom.trim(),
        dateTo: dateTo.trim(),
        branchId,
        serviceId,
      },
    );
    return { success: true, data };
  }

  @Get('slots')
  @Public()
  @ApiOperation({ summary: 'Get available time slots for a branch/service/date (public)' })
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'serviceId', required: true })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'subServiceId', required: false })
  async getSlots(
    @Query('branchId') branchId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
    @Query('subServiceId') subServiceId?: string,
  ) {
    const data = await this.appointmentService.getAvailableSlots(
      branchId,
      serviceId,
      date,
      subServiceId,
    );
    return { success: true, data };
  }

  @Post('book')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book an appointment (public)' })
  async book(@Body() body: BookAppointmentDto) {
    const data = await this.appointmentService.book(body);
    return { success: true, data };
  }

  @Get('public/:id')
  @Public()
  @SkipAppointmentFeatureGuard()
  @Throttle(AppointmentController.PUBLIC_LOOKUP_THROTTLE)
  @ApiOperation({ summary: 'Get appointment status (public, PII stripped)' })
  async getPublic(@Param('id') id: string) {
    const data = await this.appointmentService.getPublicById(id);
    return { success: true, data };
  }

  @Post(':id/cancel')
  @Public()
  @SkipAppointmentFeatureGuard()
  @Throttle(AppointmentController.PUBLIC_MUTATION_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an appointment (public self-service)' })
  async cancelPublic(@Param('id') id: string) {
    const data = await this.appointmentService.cancelPublic(id);
    return { success: true, data };
  }

  @Get('customer-lookup')
  @Public()
  @Throttle(AppointmentController.PUBLIC_LOOKUP_THROTTLE)
  @ApiOperation({ summary: 'Look up appointments by email or phone (customer portal)' })
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'phone', required: false })
  async customerLookup(
    @Query('branchId') branchId?: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }
    const data = await this.appointmentService.customerLookup(branchId, email, phone);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  @RequirePermissions({ resource: 'appointment', action: 'read' })
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.appointmentService.getById(user.orgId, id);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update appointment' })
  @RequirePermissions({ resource: 'appointment', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateAppointmentDto,
  ) {
    const data = await this.appointmentService.update(user.orgId, id, user.userId, body);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete appointment' })
  @RequirePermissions({ resource: 'appointment', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.appointmentService.delete(user.orgId, id, user.userId);
  }
}
