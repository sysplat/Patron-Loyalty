import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyCrmTaskService } from '../loyalty-crm-task.service';
import { LoyaltyCrmExtendedService } from '../loyalty-crm-extended.service';
import {
  CreateCrmTaskDto,
  CreateCrmSupportTicketDto,
  CreateCrmSalesOpportunityDto,
  UpdateCrmTaskDto,
  UpdateCrmSupportTicketDto,
  UpdateCrmSalesOpportunityDto,
} from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyCrmController {
  constructor(
    private readonly crmTasks: LoyaltyCrmTaskService,
    private readonly crmExtended: LoyaltyCrmExtendedService,
  ) {}

  @Get('tasks')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listOpenTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.crmTasks.listOpen(user.orgId);
  }

  @Get('tasks/customer/:customerId')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listCustomerTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.crmTasks.listForCustomer(user.orgId, customerId);
  }

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createTask(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCrmTaskDto) {
    return this.crmTasks.create(user.orgId, {
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    });
  }

  @Patch('tasks/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmTaskDto,
  ) {
    return this.crmTasks.update(user.orgId, id, {
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : body.dueAt,
    });
  }

  @Get('crm/support-tickets')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listSupportTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.crmExtended.listSupportTickets(user.orgId, customerId);
  }

  @Post('crm/support-tickets')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createSupportTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmSupportTicketDto,
  ) {
    return this.crmExtended.createSupportTicket(user.orgId, {
      customerId: body.customerId,
      subject: body.subject,
      description: body.description ?? undefined,
      priority: body.priority,
      assigneeId: body.assigneeId ?? undefined,
    });
  }

  @Patch('crm/support-tickets/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateSupportTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmSupportTicketDto,
  ) {
    return this.crmExtended.updateSupportTicket(user.orgId, id, body);
  }

  @Get('crm/sales-opportunities')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listSalesOpportunities(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.crmExtended.listSalesOpportunities(user.orgId, customerId);
  }

  @Post('crm/sales-opportunities')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createSalesOpportunity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmSalesOpportunityDto,
  ) {
    return this.crmExtended.createSalesOpportunity(user.orgId, {
      customerId: body.customerId,
      title: body.title,
      stage: body.stage,
      valueCents: body.valueCents,
      expectedCloseDate: body.expectedCloseDate ?? undefined,
      notes: body.notes ?? undefined,
      assigneeId: body.assigneeId ?? undefined,
    });
  }

  @Patch('crm/sales-opportunities/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateSalesOpportunity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmSalesOpportunityDto,
  ) {
    return this.crmExtended.updateSalesOpportunity(user.orgId, id, body);
  }
}
