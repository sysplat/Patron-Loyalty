import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { Public } from '../../../common/decorators/public.decorator';
import { loyaltyMarketingProviderSchema } from '@queueplatform/shared';
import { LoyaltyApiKeyGuard } from '../guards/loyalty-api-key.guard';
import { LoyaltyOrgId } from '../decorators/loyalty-org.decorator';
import { LoyaltyMarketingConnectionService } from '../loyalty-marketing-connection.service';
import { LoyaltyMarketingSyncService } from '../loyalty-marketing-sync.service';
import {
  LoyaltyKlaviyoConnectionDto,
  LoyaltyMailchimpConnectionDto,
} from '../dto/loyalty-marketing.dto';

@ApiTags('Loyalty Marketing Integrations')
@Controller('loyalty/integrations/marketing')
@UseGuards(LoyaltyApiKeyGuard)
@Public()
export class LoyaltyMarketingController {
  constructor(
    private readonly connections: LoyaltyMarketingConnectionService,
    private readonly syncService: LoyaltyMarketingSyncService,
  ) {}

  @Get()
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({ summary: 'List active marketing connections (credentials redacted)' })
  listConnections(@LoyaltyOrgId() orgId: string) {
    return this.connections.listConnections(orgId);
  }

  @Post('klaviyo')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({ summary: 'Configure or update Klaviyo connection' })
  upsertKlaviyo(
    @LoyaltyOrgId() orgId: string,
    @Body(new ZodValidationPipe(LoyaltyKlaviyoConnectionDto)) body: LoyaltyKlaviyoConnectionDto,
  ) {
    return this.connections.upsertKlaviyo(orgId, body);
  }

  @Post('mailchimp')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({ summary: 'Configure or update Mailchimp connection' })
  upsertMailchimp(
    @LoyaltyOrgId() orgId: string,
    @Body(new ZodValidationPipe(LoyaltyMailchimpConnectionDto)) body: LoyaltyMailchimpConnectionDto,
  ) {
    return this.connections.upsertMailchimp(orgId, body);
  }

  @Delete(':provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({ summary: 'Remove a marketing connection' })
  deleteConnection(
    @LoyaltyOrgId() orgId: string,
    @Param('provider', new ZodValidationPipe(loyaltyMarketingProviderSchema)) provider: string,
  ) {
    return this.connections.deleteConnection(orgId, provider as any);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({
    summary: 'Trigger a full org-wide marketing sync',
    description:
      'Syncs all loyalty accounts to all active marketing connections. May take a while for large orgs.',
  })
  async syncAll(@LoyaltyOrgId() orgId: string) {
    const result = await this.syncService.syncAll(orgId);
    return { synced: result.synced, errors: result.errors };
  }
}
