import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AgentSessionService } from './agent-session.service';
import { AgentSessionHeartbeatDto, StartAgentSessionDto } from './dto/workbench.dto';

@ApiTags('Agent sessions')
@ApiBearerAuth()
@Controller({ path: 'agent-sessions', version: '1' })
export class AgentSessionController {
  constructor(private readonly agentSessionService: AgentSessionService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get current active agent session' })
  @RequirePermissions({ resource: 'ticket', action: 'read' })
  async getActive(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Query('surface') surface?: string,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.agentSessionService.getActive(user.orgId, userId!, surface);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Start agent session (ends any prior active session)' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async start(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: StartAgentSessionDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.agentSessionService.start(user.orgId, userId!, body);
    return { success: true, data };
  }

  @Patch(':id/heartbeat')
  @ApiOperation({ summary: 'Session heartbeat' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async heartbeat(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Param('id') id: string,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.agentSessionService.heartbeat(user.orgId, userId!, id);
    return { success: true, data };
  }

  @Post('end')
  @ApiOperation({ summary: 'End active session(s)' })
  @RequirePermissions({ resource: 'ticket', action: 'update' })
  async end(
    @CurrentUser() user: { orgId: string; userId?: string; id?: string },
    @Body() body: AgentSessionHeartbeatDto,
  ) {
    const userId = user.userId ?? user.id;
    const data = await this.agentSessionService.end(
      user.orgId,
      userId!,
      body.sessionId,
      body.surface,
    );
    return { success: true, data };
  }
}
