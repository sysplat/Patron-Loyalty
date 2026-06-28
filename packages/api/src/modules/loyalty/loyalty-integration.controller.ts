import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LoyaltyOrgId } from './decorators/loyalty-org.decorator';
import { LoyaltyApiKeyGuard } from './guards/loyalty-api-key.guard';
import { LoyaltyIntegrationService } from './loyalty-integration.service';
import {
  LoyaltyIntegrationCouponRedeemDto,
  LoyaltyIntegrationEarnDto,
  LoyaltyIntegrationRedeemDto,
  LoyaltyIntegrationUpsertCustomerDto,
  LoyaltyIntegrationValidateCouponDto,
  LoyaltyIntegrationWalletAdjustDto,
} from './dto/loyalty-integration.dto';
import { LoyaltyIntegrationQueueEventDto } from './dto/loyalty-connector.dto';
import { LoyaltyQueueEventsService } from './loyalty-queue-events.service';
import {
  LoyaltyConnectorObservabilityService,
  type ConnectorIngestOutcome,
} from './loyalty-connector-observability.service';

function deriveConnectorOutcome(result: Record<string, unknown>): ConnectorIngestOutcome {
  if (result.idempotent === true) return 'idempotent';
  if (result.skipped === true) return 'skipped';
  return 'ok';
}

@ApiTags('Loyalty Integrations')
@Public()
@UseGuards(LoyaltyApiKeyGuard)
@ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
@Controller('loyalty/integrations/v1')
export class LoyaltyIntegrationController {
  constructor(
    @Inject(LoyaltyIntegrationService)
    private readonly integration: LoyaltyIntegrationService,
    @Inject(LoyaltyQueueEventsService)
    private readonly queueEvents: LoyaltyQueueEventsService,
    @Inject(LoyaltyConnectorObservabilityService)
    private readonly connectorObs: LoyaltyConnectorObservabilityService,
  ) {}

  @Get('customers/lookup')
  @ApiOperation({ summary: 'Look up patron by customerId, email, phone, or external ID' })
  lookupCustomer(
    @LoyaltyOrgId() orgId: string,
    @Query('customerId') customerId?: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
    @Query('externalId') externalId?: string,
  ) {
    return this.integration.lookupCustomer(orgId, { customerId, email, phone, externalId });
  }

  @Post('customers/upsert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or resolve patron by email, phone, or external ID' })
  upsertCustomer(
    @LoyaltyOrgId() orgId: string,
    @Body(new ZodValidationPipe(LoyaltyIntegrationUpsertCustomerDto))
    body: LoyaltyIntegrationUpsertCustomerDto,
  ) {
    return this.integration.upsertCustomer(orgId, body);
  }

  @Post('points/earn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Award points from POS or e-commerce (idempotent by externalTxnId)' })
  earnPoints(
    @LoyaltyOrgId() orgId: string,
    @Body(new ZodValidationPipe(LoyaltyIntegrationEarnDto)) body: LoyaltyIntegrationEarnDto,
  ) {
    return this.integration.earnPoints(orgId, body);
  }

  @Post('rewards/redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redeem a catalog reward for a patron' })
  redeemReward(@LoyaltyOrgId() orgId: string, @Body() body: LoyaltyIntegrationRedeemDto) {
    return this.integration.redeemReward(orgId, body);
  }

  @Post('coupons/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a coupon code' })
  validateCoupon(@LoyaltyOrgId() orgId: string, @Body() body: LoyaltyIntegrationValidateCouponDto) {
    return this.integration.validateCoupon(orgId, body);
  }

  @Post('coupons/redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redeem a coupon for a patron' })
  redeemCoupon(@LoyaltyOrgId() orgId: string, @Body() body: LoyaltyIntegrationCouponRedeemDto) {
    return this.integration.redeemCoupon(orgId, body);
  }

  @Post('wallet/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Credit or debit patron wallet balance' })
  adjustWallet(@LoyaltyOrgId() orgId: string, @Body() body: LoyaltyIntegrationWalletAdjustDto) {
    return this.integration.adjustWallet(orgId, body);
  }

  @Post('queue-events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ingest normalized QlessQ queue events (ticket/appointment/review/customer)',
  })
  ingestQueueEvent(
    @LoyaltyOrgId() orgId: string,
    @Body(new ZodValidationPipe(LoyaltyIntegrationQueueEventDto))
    body: LoyaltyIntegrationQueueEventDto,
  ) {
    const started = Date.now();
    return this.queueEvents.processRemoteEvent(orgId, body).then((result) => {
      const record = result as Record<string, unknown>;
      this.connectorObs.logIngest({
        orgId,
        route: 'queue-events',
        event: body.event,
        sourceId: body.sourceId,
        connectorVersion: body.connectorVersion,
        durationMs: Date.now() - started,
        outcome: deriveConnectorOutcome(record),
        idempotent: record.idempotent === true,
        skippedReason: typeof record.reason === 'string' ? record.reason : undefined,
      });
      return result;
    });
  }
}
