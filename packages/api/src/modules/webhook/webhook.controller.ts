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
import { WebhookService } from './webhook.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  @RequirePermissions({ resource: 'settings', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.webhookService.list(user.orgId);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create webhook endpoint' })
  @RequirePermissions({ resource: 'settings', action: 'create' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateWebhookDto) {
    const data = await this.webhookService.create(user.orgId, body);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook endpoint' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateWebhookDto,
  ) {
    const data = await this.webhookService.update(user.orgId, id, body);
    return { success: true, data };
  }

  @Post(':id/rotate-secret')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate webhook secret' })
  @RequirePermissions({ resource: 'settings', action: 'update' })
  async rotateSecret(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.webhookService.rotateSecret(user.orgId, id);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  @RequirePermissions({ resource: 'settings', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.webhookService.delete(user.orgId, id);
  }
}
