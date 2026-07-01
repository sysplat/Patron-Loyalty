import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { LoyaltyMarketingSyncService } from '../loyalty-marketing-sync.service';

@ApiTags('Loyalty Marketing Webhooks')
@Controller('loyalty/integrations/marketing/webhooks')
@Public()
export class LoyaltyMarketingWebhookController {
  private readonly logger = new Logger(LoyaltyMarketingWebhookController.name);

  constructor(private readonly syncService: LoyaltyMarketingSyncService) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive webhook from marketing provider' })
  async handleWebhook(@Param('provider') provider: string, @Req() req: RawBodyRequest<Request>) {
    this.logger.log(`Received marketing webhook for provider=${provider}`);

    // Process webhook async to not block the response
    const payload = req.body;
    void this.syncService.processWebhook(provider, payload);

    return { received: true };
  }
}
