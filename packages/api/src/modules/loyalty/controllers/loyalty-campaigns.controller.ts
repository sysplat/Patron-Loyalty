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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyCampaignService } from '../loyalty-campaign.service';
import { CreateLoyaltyCampaignDto, UpdateLoyaltyCampaignDto } from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyCampaignsController {
  constructor(
    private readonly campaigns: LoyaltyCampaignService,
    private readonly audit: AuditService,
  ) {}

  @Get('campaigns')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listCampaigns(@CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.list(user.orgId);
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async createCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateLoyaltyCampaignDto,
  ) {
    const campaign = await this.campaigns.create(user.orgId, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    });
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_CREATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_CAMPAIGN,
      resourceId: campaign.id,
      metadata: { campaignId: campaign.id },
    });
    return campaign;
  }

  @Patch('campaigns/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async updateCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoyaltyCampaignDto,
  ) {
    const campaign = await this.campaigns.update(user.orgId, id, body);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_UPDATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_CAMPAIGN,
      resourceId: id,
      metadata: { campaignId: id },
    });
    return campaign;
  }

  @Post('campaigns/:id/launch')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async launchCampaign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const campaign = await this.campaigns.launch(user.orgId, id);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_LAUNCHED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_CAMPAIGN,
      resourceId: id,
      metadata: { campaignId: id },
    });
    return campaign;
  }

  @Delete('campaigns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async deleteCampaign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.campaigns.delete(user.orgId, id);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_DELETED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_CAMPAIGN,
      resourceId: id,
      metadata: { campaignId: id },
    });
  }
}
