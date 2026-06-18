import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DisplayService } from './display.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AllowBranchScopedListRead,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { DisplayAuthGuard } from '../../common/guards/display-auth.guard';
import {
  ClaimReversePairingDto,
  CreateDisplayThemeDto,
  LinkDisplayScreenDto,
  RefreshDisplayTokenDto,
  UpdateDisplayDeviceDto,
  UpdateDisplayThemeDto,
} from './dto/display.dto';

@ApiTags('Display')
@ApiBearerAuth()
@Controller('display')
export class DisplayController {
  constructor(private readonly displayService: DisplayService) {}
  private static readonly PUBLIC_PAIRING_THROTTLE = { medium: { limit: 20, ttl: 60_000 } };

  // ─── Admin Endpoints (JWT-authenticated) ───────

  @Get('devices')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'List display devices' })
  @ApiQuery({ name: 'branchId', required: false })
  @RequirePermissions({ resource: 'display', action: 'read' })
  async list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string) {
    const data = await this.displayService.listForPrincipal(user.orgId, user.userId, branchId);
    return { success: true, data };
  }

  @Get('devices/:id')
  @AllowBranchScopedListRead()
  @ApiOperation({ summary: 'Get display device' })
  @RequirePermissions({ resource: 'display', action: 'read' })
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.displayService.getByIdForPrincipal(user.orgId, user.userId, id);
    return { success: true, data };
  }

  @Post('pairing/link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link a TV-shown pairing code to a branch (reverse pairing)' })
  @RequirePermissions({ resource: 'display', action: 'create' })
  async linkScreen(@CurrentUser() user: AuthenticatedUser, @Body() body: LinkDisplayScreenDto) {
    const data = await this.displayService.linkScreenForPrincipal(user.orgId, user.userId, body);
    return { success: true, data };
  }

  @Patch('devices/:id')
  @ApiOperation({ summary: 'Update display device' })
  @RequirePermissions({ resource: 'display', action: 'update' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateDisplayDeviceDto,
  ) {
    const data = await this.displayService.update(user.orgId, id, body);
    return { success: true, data };
  }

  @Post('devices/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a display device (invalidate its API key and session)' })
  @RequirePermissions({ resource: 'display', action: 'delete' })
  async revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.displayService.revoke(user.orgId, id);
    return { success: true, data };
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete display device' })
  @RequirePermissions({ resource: 'display', action: 'delete' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.displayService.delete(user.orgId, id);
  }

  // ─── Public Pairing Endpoints (no auth) ────────

  @Post('pairing/request')
  @Public()
  @Throttle(DisplayController.PUBLIC_PAIRING_THROTTLE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'TV requests a pairing code to display (reverse pairing)' })
  async requestReversePairing() {
    const data = await this.displayService.requestReversePairingCode();
    return { success: true, data };
  }

  @Get('pairing/status/:sessionId')
  @Public()
  @ApiOperation({ summary: 'TV polls until admin has linked the screen' })
  async getReversePairingStatus(@Param('sessionId') sessionId: string) {
    const data = await this.displayService.getReversePairingStatus(sessionId);
    return { success: true, data };
  }

  @Post('pairing/claim')
  @Public()
  @Throttle(DisplayController.PUBLIC_PAIRING_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'TV claims credentials after admin linked the code' })
  async claimReversePairing(@Body() body: ClaimReversePairingDto) {
    const data = await this.displayService.claimReversePairing(
      body.sessionId,
      body.deviceFingerprint,
    );
    return { success: true, data };
  }

  @Post('devices/refresh-token')
  @Public()
  @Throttle(DisplayController.PUBLIC_PAIRING_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange API key for a fresh session token (public endpoint for display screens)',
    description:
      'Called by the TV when its current JWT expires. Returns a new short-lived sessionToken.',
  })
  @ApiHeader({
    name: 'X-Display-Api-Key',
    description: 'The permanent API key issued during pairing',
    required: true,
  })
  async refreshToken(@Body() body: RefreshDisplayTokenDto) {
    const data = await this.displayService.refreshToken(body.apiKey, body.deviceFingerprint);
    return { success: true, data };
  }

  // ─── Display-Authenticated Endpoints ───────────

  @Post('devices/heartbeat')
  @Public()
  @UseGuards(DisplayAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Device heartbeat (display-token authenticated)' })
  @ApiHeader({
    name: 'X-Display-Token',
    description: 'Short-lived JWT session token',
    required: true,
  })
  async heartbeat(@Req() req: Request & { displayDevice?: any }) {
    const data = await this.displayService.heartbeat(req.displayDevice.id, req.displayDevice.orgId);
    return { success: true, data };
  }

  // ─── Themes ──────────────────────────────────

  @Get('themes')
  @ApiOperation({ summary: 'List display themes' })
  @RequirePermissions({ resource: 'display', action: 'read' })
  async listThemes(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.displayService.listThemes(user.orgId);
    return { success: true, data };
  }

  @Post('themes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create display theme' })
  @RequirePermissions({ resource: 'display', action: 'create' })
  async createTheme(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateDisplayThemeDto) {
    const data = await this.displayService.createTheme(user.orgId, body);
    return { success: true, data };
  }

  @Patch('themes/:id')
  @ApiOperation({ summary: 'Update display theme' })
  @RequirePermissions({ resource: 'display', action: 'update' })
  async updateTheme(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateDisplayThemeDto,
  ) {
    const data = await this.displayService.updateTheme(user.orgId, id, body);
    return { success: true, data };
  }

  @Delete('themes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete display theme' })
  @RequirePermissions({ resource: 'display', action: 'delete' })
  async deleteTheme(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.displayService.deleteTheme(user.orgId, id);
  }
}
