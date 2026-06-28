import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyApiKeyService } from '../loyalty-api-key.service';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyApiKeyController {
  constructor(private readonly apiKeys: LoyaltyApiKeyService) {}

  @Get('integrations/api-key')
  @ApiOperation({ summary: 'LMS integration API key status' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  getIntegrationApiKeyStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeys.getStatus(user.orgId);
  }

  @Post('integrations/api-key/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a new LMS integration API key (shown once)' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  rotateIntegrationApiKey(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeys.rotateKey(user.orgId);
  }

  @Post('integrations/api-key/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke LMS integration API key' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async revokeIntegrationApiKey(@CurrentUser() user: AuthenticatedUser) {
    await this.apiKeys.revokeKey(user.orgId);
  }
}
