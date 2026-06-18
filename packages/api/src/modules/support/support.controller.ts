import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SupportService } from './support.service';
import {
  CreateSupportRequestDto,
  ReassignSupportContactDto,
  SupportMessageDto,
} from './dto/support.dto';

@ApiTags('support')
@ApiBearerAuth()
@Controller({ path: 'support', version: '1' })
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Submit a support request to QlessQ support' })
  async create(
    @CurrentUser()
    user: {
      orgId: string;
      userId: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
    },
    @Body() body: CreateSupportRequestDto,
  ) {
    const data = await this.supportService.submit(user.orgId, user, body);
    return { success: true, data };
  }

  @Get('requests')
  @ApiOperation({ summary: 'List support requests for current organization' })
  async list(@CurrentUser() user: { orgId: string; userId: string }) {
    const data = await this.supportService.listForOrg(user.orgId, user.userId);
    return { success: true, data };
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get a support request with thread for current organization' })
  async getById(@CurrentUser() user: { orgId: string; userId: string }, @Param('id') id: string) {
    const data = await this.supportService.getForOrg(user.orgId, user.userId, id);
    return { success: true, data };
  }

  @Post('requests/:id/replies')
  @ApiOperation({ summary: 'Reply to a support request from tenant dashboard' })
  async addOrgReply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SupportMessageDto,
  ) {
    const data = await this.supportService.addOrgReply(user.orgId, user, id, body);
    return { success: true, data };
  }

  @Post('requests/:id/close')
  @ApiOperation({ summary: 'Close/resolve a support request from tenant dashboard' })
  async closeRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.supportService.closeRequest(user.orgId, user, id);
    return { success: true, data };
  }

  @Patch('requests/:id/contact')
  @ApiOperation({ summary: 'Reassign the org contact who may reply to QlessQ support' })
  async reassignContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ReassignSupportContactDto,
  ) {
    const data = await this.supportService.reassignContact(
      user.orgId,
      user,
      id,
      body.contactUserId,
    );
    return { success: true, data };
  }
}
