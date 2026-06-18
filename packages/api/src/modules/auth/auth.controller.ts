import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { TwoFactorService } from './two-factor.service';
import {
  RegisterDto,
  LoginDto,
  TwoFactorLoginDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  EnableTwoFactorDto,
  DisableTwoFactorDto,
  RegenerateBackupCodesDto,
} from './dto/auth.dto';

/** Strict rate limit applied to brute-force-sensitive auth endpoints: 5 requests / minute */
const AUTH_THROTTLE = { medium: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Register a new business account' })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() body: RegisterDto) {
    const result = await this.authService.register({
      businessName: body.organizationName ?? body.businessName ?? '',
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password,
      phone: body.phone,
      acceptLegal: body.acceptLegal === true,
      productSku: body.productSku,
    });
    return { success: true, data: result };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(body.email, body.password, body.orgId, {
      platformAdmin: body.platformAdmin === true,
    });
    return { success: true, data: result };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login after TOTP (second step)' })
  async twoFactorLogin(@Body() body: TwoFactorLoginDto) {
    const result = await this.authService.completeTwoFactorLogin(body.twoFactorToken, body.code);
    return { success: true, data: result };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with token' })
  async verifyEmail(@Body() body: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(body.token);
    return { success: true, data: result };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset link' })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(body.email);
    return { success: true, data: result };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with email token',
    description:
      'Sets a new password, clears two-factor authentication (TOTP and backup codes), revokes all sessions, and marks the email verified. Organization owners may request the reset link via forgot-password.',
  })
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.authService.resetPassword(body.token, body.password);
    return { success: true, data: result };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() body: RefreshTokenDto) {
    const result = await this.authService.refreshTokens(body.refreshToken);
    return { success: true, data: result };
  }

  @Get('session')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current session: platform operator flag (tenant web)' })
  @ApiResponse({ status: 200, description: 'Session flags' })
  async session(@CurrentUser('userId') userId: string) {
    const data = await this.authService.getSessionProfile(userId);
    return { success: true, data };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke session' })
  async logout(@CurrentUser('userId') userId: string) {
    const result = await this.authService.logout(userId);
    return { success: true, data: result };
  }

  @Post('2fa/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get two-factor authentication status' })
  async getTwoFactorStatus(@CurrentUser('userId') userId: string) {
    const result = await this.twoFactorService.getStatus(userId);
    return { success: true, data: result };
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Begin two-factor authentication setup' })
  async beginTwoFactorSetup(@CurrentUser('userId') userId: string) {
    const result = await this.twoFactorService.beginSetup(userId);
    return { success: true, data: result };
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  async enableTwoFactor(@CurrentUser('userId') userId: string, @Body() body: EnableTwoFactorDto) {
    const result = await this.twoFactorService.enable(userId, body.code);
    return { success: true, data: result };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  async disableTwoFactor(@CurrentUser('userId') userId: string, @Body() body: DisableTwoFactorDto) {
    const result = await this.twoFactorService.disable(userId, body.password, body.code);
    return { success: true, data: result };
  }

  @Post('2fa/cancel-setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel pending two-factor enrollment before it is enabled' })
  async cancelTwoFactorSetup(@CurrentUser('userId') userId: string) {
    const result = await this.twoFactorService.cancelSetup(userId);
    return { success: true, data: result };
  }

  @Post('2fa/backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate backup codes (password + authenticator code required)' })
  async regenerateBackupCodes(
    @CurrentUser('userId') userId: string,
    @Body() body: RegenerateBackupCodesDto,
  ) {
    const result = await this.twoFactorService.regenerateBackupCodes(
      userId,
      body.password,
      body.code,
    );
    return { success: true, data: result };
  }
}
