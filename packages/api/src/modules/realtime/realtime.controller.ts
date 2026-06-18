import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RealtimeService } from './realtime.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CentrifugoWebhookDto } from './dto/realtime.dto';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  private static readonly PUBLIC_REALTIME_THROTTLE = { medium: { limit: 20, ttl: 60_000 } };

  /**
   * Public endpoint for display devices to get a connection token.
   * This allows the device to connect to Centrifugo without a full user session.
   */
  @Public()
  @Throttle(RealtimeController.PUBLIC_REALTIME_THROTTLE)
  @Get('display-token')
  async getDisplayToken(
    @Query('deviceId') deviceId: string,
    @Headers('x-display-token') displaySessionToken?: string,
  ) {
    if (!deviceId) return { error: 'deviceId is required' };
    if (!displaySessionToken) throw new UnauthorizedException('Missing X-Display-Token header');
    const verified = this.realtimeService.verifyDisplaySessionToken(displaySessionToken);
    if (verified.deviceId !== deviceId) {
      throw new UnauthorizedException('Display session token does not match device');
    }
    const token = await this.realtimeService.generateDisplayToken(deviceId);
    return { token };
  }

  @Get('user-token')
  async getUserToken(@CurrentUser() user: { userId: string; orgId: string }) {
    const token = await this.realtimeService.generateUserToken(user.userId, user.orgId);
    return { token };
  }

  /**
   * Centrifugo webhook endpoint.
   * Configured in Centrifugo as 'proxy_http_url'.
   */
  @Public()
  @Throttle(RealtimeController.PUBLIC_REALTIME_THROTTLE)
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: CentrifugoWebhookDto,
    @Headers('x-centrifugo-webhook-secret') webhookSecret?: string,
  ) {
    if (!this.realtimeService.isValidWebhookAuth(webhookSecret)) {
      throw new UnauthorizedException('Invalid realtime webhook secret');
    }
    const { method } = body;
    const params = (body.params ?? {}) as Record<string, unknown>;

    // Centrifugo sends 'connect' and 'disconnect' methods
    if (method === 'connect') {
      const userId = typeof params.user === 'string' ? params.user : undefined;
      if (userId) {
        await this.realtimeService.handlePresenceWebhook('connect', userId);
      }
      // Return allow response
      return { result: {} };
    }

    if (method === 'disconnect') {
      const userId = typeof params.user === 'string' ? params.user : undefined;
      if (userId) {
        await this.realtimeService.handlePresenceWebhook('disconnect', userId);
      }
      return { result: {} };
    }

    if (method === 'subscribe') {
      const userId = typeof params.user === 'string' ? params.user : undefined;
      const channel = typeof params.channel === 'string' ? params.channel : undefined;
      if (!userId || !channel) {
        return { result: { allow: false } };
      }
      const allow = await this.realtimeService.authorizeSubscription({
        userId,
        channel,
        info: (params.info as Record<string, unknown>) ?? {},
      });
      return { result: { allow } };
    }

    return { result: {} };
  }
}
