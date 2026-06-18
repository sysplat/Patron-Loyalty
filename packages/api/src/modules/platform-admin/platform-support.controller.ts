import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupportService } from '../support/support.service';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { SupportMessageDto, UpdateSupportRequestDto } from '../support/dto/support.dto';

@ApiTags('platform-admin', 'support')
@ApiBearerAuth()
@UseGuards(PlatformOperatorGuard)
@Controller({ path: 'platform-admin/support', version: '1' })
export class PlatformSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('unread-count')
  @ApiOperation({ summary: 'Platform operator queue: count requests with unread tenant replies' })
  async unreadCount() {
    const count = await this.supportService.countUnreadForPlatform();
    return { success: true, data: { count } };
  }

  @Get('requests')
  @ApiOperation({ summary: 'Platform operator queue: list support requests across tenants' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'orgId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  async listForPlatform(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('orgId') orgId?: string,
    @Query('search') search?: string,
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const data = await this.supportService.listForPlatform({
      status,
      priority,
      category,
      orgId,
      search,
      skip: skipRaw !== undefined ? parseInt(skipRaw, 10) || 0 : undefined,
      take: takeRaw !== undefined ? parseInt(takeRaw, 10) || undefined : undefined,
    });
    return { success: true, data };
  }

  @Get('requests/:id')
  @ApiOperation({
    summary: 'Platform operator queue: get support request with correlation context',
  })
  async getForPlatform(@Param('id') id: string) {
    const data = await this.supportService.getForPlatform(id);
    return { success: true, data };
  }

  @Post('requests/:id/replies')
  @ApiOperation({ summary: 'Platform operator queue: add ticket reply/internal note' })
  async addPlatformReply(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: SupportMessageDto,
  ) {
    const data = await this.supportService.addPlatformReply(user, id, body);
    return { success: true, data };
  }

  @Patch('requests/:id')
  @ApiOperation({ summary: 'Platform operator queue: update status/priority/category/assignee' })
  async updateForPlatform(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: UpdateSupportRequestDto,
  ) {
    const data = await this.supportService.updatePlatformRequest(user, id, body);
    return { success: true, data };
  }
}
