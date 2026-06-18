import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { AuthService } from '../auth/auth.service';
import { PlatformImpersonationDto } from './dto/platform.dto';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/impersonation', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformImpersonationController {
  constructor(private readonly auth: AuthService) {}

  @Post('start')
  @ApiOperation({
    summary: 'Start tenant impersonation — returns short-lived access JWT (no refresh token)',
  })
  async start(@CurrentUser() user: AuthenticatedUser, @Body() body: PlatformImpersonationDto) {
    const data = await this.auth.startImpersonation(
      { userId: user.userId, email: user.email },
      body.orgId,
      {
        role: body.role,
        branchId: body.branchId,
      },
    );
    return { success: true, data };
  }

  @Post('end')
  @ApiOperation({ summary: 'Record impersonation end (call before discarding impersonation JWT)' })
  async end(@CurrentUser() user: AuthenticatedUser & { impersonation?: boolean }) {
    if (!user.impersonation) {
      throw new BadRequestException('Not in an impersonation session');
    }
    await this.auth.endImpersonationAudit(
      { userId: user.userId, email: user.email },
      user.orgId,
      user.jti,
    );
    return { success: true, data: { message: 'Impersonation end recorded' } };
  }
}
