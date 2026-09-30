import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyApiKeyService } from '../loyalty-api-key.service';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyApiKeyController {
  constructor(
    private readonly apiKeys: LoyaltyApiKeyService,
    private readonly audit: AuditService,
  ) {}

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
  async rotateIntegrationApiKey(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.apiKeys.rotateKey(user.orgId);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.API_KEY_ROTATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_API_KEY,
      metadata: { keyPrefix: result.prefix },
    });
    return result;
  }

  @Post('integrations/api-key/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke LMS integration API key' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async revokeIntegrationApiKey(@CurrentUser() user: AuthenticatedUser) {
    await this.apiKeys.revokeKey(user.orgId);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.API_KEY_REVOKED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_API_KEY,
      metadata: {},
    });
  }
}
