import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyDiagnosticsService } from '../loyalty-diagnostics.service';

@ApiTags('Loyalty Diagnostics')
@ApiBearerAuth()
@Controller('loyalty/diagnostics')
export class LoyaltyDiagnosticsController {
  constructor(private readonly diagnostics: LoyaltyDiagnosticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Tenant diagnostics summary (org admin)' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query('windowHours') windowHours?: string) {
    const hours = windowHours ? Number(windowHours) : 24;
    return this.diagnostics.getSummary(user.orgId, Number.isFinite(hours) ? hours : 24);
  }

  @Get('delivery-timeline')
  @ApiOperation({
    summary: 'OTP → earn → redeem → campaign → provider delivery timeline',
  })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  getDeliveryTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('requestId') requestId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.diagnostics.getDeliveryTimeline(user.orgId, {
      customerId,
      campaignId,
      requestId,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Get('integration-events')
  @ApiOperation({ summary: 'Redacted connector / POS / integration ingest log' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  listIntegrationEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('route') route?: string,
    @Query('outcome') outcome?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.diagnostics.listIntegrationEvents(user.orgId, {
      route,
      outcome,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }
}
