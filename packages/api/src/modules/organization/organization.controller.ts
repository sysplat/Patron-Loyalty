import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { AuditService } from '../../common/audit/audit.service';
import { OrganizationService } from './organization.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UpdateOrganizationDto } from './dto/organization.dto';

@ApiTags('organization')
@ApiBearerAuth()
@Controller({ path: 'organization', version: '1' })
export class OrganizationController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current organization details' })
  @RequirePermissions({ resource: 'organization', action: 'read' })
  async get(@CurrentUser('orgId') orgId: string) {
    const data = await this.orgService.getOrganization(orgId);
    return { success: true, data };
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get organization profile without logo payload' })
  @RequirePermissions({ resource: 'organization', action: 'read' })
  async getProfile(@CurrentUser('orgId') orgId: string) {
    const data = await this.orgService.getOrganizationProfile(orgId);
    return { success: true, data };
  }

  @Get('logo')
  @ApiOperation({ summary: 'Get organization logo only' })
  @RequirePermissions({ resource: 'organization', action: 'read' })
  async getLogo(@CurrentUser('orgId') orgId: string) {
    const data = await this.orgService.getOrganizationLogo(orgId);
    return { success: true, data };
  }

  @Get('settings-init')
  @ApiOperation({ summary: 'Settings organization tab bootstrap (profile + kiosk flags)' })
  @RequirePermissions({ resource: 'organization', action: 'read' })
  async getSettingsInit(@CurrentUser('orgId') orgId: string) {
    const data = await this.orgService.getSettingsPageInit(orgId);
    return { success: true, data };
  }

  @Patch()
  @RequirePermissions({ resource: 'organization', action: 'update' })
  @ApiOperation({ summary: 'Update organization details' })
  async update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateOrganizationDto) {
    const data = await this.orgService.updateOrganization(user.orgId, user.userId, body);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.ORG_UPDATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.ORGANIZATION,
      resourceId: user.orgId,
      metadata: {
        changedFields: Object.keys(body),
      },
    });
    return { success: true, data };
  }
}
