import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateIntegrationDto,
  CreateSettingsWebhookDto,
  SetBulkSettingsDto,
  SetSettingDto,
  UpdateIntegrationDto,
} from './dto/settings.dto';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all organization settings' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  getAll(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getAll(user.orgId);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a specific setting' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.settingsService.get(user.orgId, key);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a setting value' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  set(@CurrentUser() user: AuthenticatedUser, @Body() body: SetSettingDto) {
    return this.settingsService.set(user.orgId, body.key, body.value);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set multiple settings' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  setBulk(@CurrentUser() user: AuthenticatedUser, @Body() body: SetBulkSettingsDto) {
    return this.settingsService.setBulk(user.orgId, body);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a setting' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    await this.settingsService.delete(user.orgId, key);
  }

  // ─── Feature Flags ───────────────────────────

  @Get('features/flags')
  @ApiOperation({ summary: 'List feature flags' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  getFeatureFlags(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getFeatureFlags(user.orgId);
  }

  // ─── Integrations ────────────────────────────

  @Get('integrations')
  @ApiOperation({ summary: 'List integrations' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  listIntegrations(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.listIntegrations(user.orgId);
  }

  @Post('integrations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create integration' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  createIntegration(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateIntegrationDto) {
    return this.settingsService.createIntegration(user.orgId, body);
  }

  @Patch('integrations/:id')
  @ApiOperation({ summary: 'Update integration' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  updateIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateIntegrationDto,
  ) {
    return this.settingsService.updateIntegration(user.orgId, id, body);
  }

  @Delete('integrations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete integration' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  async deleteIntegration(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.settingsService.deleteIntegration(user.orgId, id);
  }

  // ─── Webhooks ─────────────────────────────────

  @Get('webhooks')
  @ApiOperation({ summary: 'List webhooks' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  listWebhooks(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.listWebhooks(user.orgId);
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create webhook' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  createWebhook(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateSettingsWebhookDto) {
    return this.settingsService.createWebhook(user.orgId, body);
  }

  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  async deleteWebhook(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.settingsService.deleteWebhook(user.orgId, id);
  }
}
