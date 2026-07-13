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
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyCampaignService } from '../loyalty-campaign.service';
import { CreateLoyaltyCampaignDto, UpdateLoyaltyCampaignDto } from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyCampaignsController {
  constructor(private readonly campaigns: LoyaltyCampaignService) {}

  @Get('campaigns')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listCampaigns(@CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.list(user.orgId);
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createCampaign(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyCampaignDto) {
    return this.campaigns.create(user.orgId, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    });
  }

  @Patch('campaigns/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoyaltyCampaignDto,
  ) {
    return this.campaigns.update(user.orgId, id, body);
  }

  @Post('campaigns/:id/launch')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  launchCampaign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaigns.launch(user.orgId, id);
  }

  @Delete('campaigns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async deleteCampaign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.campaigns.delete(user.orgId, id);
  }
}
