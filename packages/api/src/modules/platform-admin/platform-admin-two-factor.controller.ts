import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { TwoFactorService, TotpChannel } from '../auth/two-factor.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BypassTwoFactor } from '../../common/decorators/bypass-two-factor.decorator';
import {
  DisableTwoFactorDto,
  EnableTwoFactorDto,
  RegenerateBackupCodesDto,
} from '../auth/dto/auth.dto';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/2fa', version: '1' })
@UseGuards(PlatformOperatorGuard)
@BypassTwoFactor()
export class PlatformAdminTwoFactorController {
  private readonly ch: TotpChannel = 'admin_dashboard';

  constructor(private readonly twoFactor: TwoFactorService) {}

  @Get('status')
  @ApiOperation({ summary: 'Two-factor authentication status for the current platform operator' })
  async status(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.twoFactor.getStatus(user.userId, undefined, this.ch);
    return { success: true, data };
  }

  @Post('setup')
  @ApiOperation({ summary: 'Start TOTP enrollment (returns secret and otpauth URL)' })
  async setup(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.twoFactor.beginSetup(user.userId, 'QlessQ Admin', this.ch);
    return { success: true, data };
  }

  @Post('enable')
  @ApiOperation({ summary: 'Confirm enrollment with a TOTP code; returns backup codes once' })
  async enable(@CurrentUser() user: AuthenticatedUser, @Body() body: EnableTwoFactorDto) {
    const data = await this.twoFactor.enable(user.userId, body.code, this.ch);
    return { success: true, data };
  }

  @Post('disable')
  @ApiOperation({ summary: 'Disable two-factor authentication (password + TOTP or backup code)' })
  async disable(@CurrentUser() user: AuthenticatedUser, @Body() body: DisableTwoFactorDto) {
    const data = await this.twoFactor.disable(user.userId, body.password, body.code, this.ch);
    return { success: true, data };
  }

  @Post('cancel-setup')
  @ApiOperation({ summary: 'Cancel pending TOTP enrollment' })
  async cancelSetup(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.twoFactor.cancelSetup(user.userId, this.ch);
    return { success: true, data };
  }

  @Post('backup-codes/regenerate')
  @ApiOperation({ summary: 'Regenerate backup codes (password + authenticator code)' })
  async regenerateBackupCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegenerateBackupCodesDto,
  ) {
    const data = await this.twoFactor.regenerateBackupCodes(
      user.userId,
      body.password,
      body.code,
      this.ch,
    );
    return { success: true, data };
  }
}
