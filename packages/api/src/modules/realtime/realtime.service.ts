import { timingSafeEqual } from 'crypto';
import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Manages real-time communication via Centrifugo.
 * Handles token generation for clients and processing webhooks for presence tracking.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generates a Centrifugo connection token for a client.
   */
  async generateToken(userId: string, context?: Record<string, any>): Promise<string> {
    const secret = this.config.get<string>('app.centrifugo.secret');
    if (!secret) {
      this.logger.error('CENTRIFUGO_SECRET is not configured');
      throw new UnauthorizedException('Realtime token signing is not configured');
    }

    // Centrifugo expects 'sub' as the user ID
    const payload = {
      sub: userId,
      info: context || {},
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };

    return this.jwtService.sign(payload, { secret });
  }

  async generateDisplayToken(deviceId: string): Promise<string> {
    const device = await this.prisma.withBypassRls((tx) =>
      tx.displayDevice.findUnique({
        where: { id: deviceId },
        select: { id: true, orgId: true, branchId: true, status: true, type: true },
      }),
    );
    if (!device || !device.orgId || !device.branchId) {
      throw new NotFoundException('Display device not found');
    }
    if (device.status !== 'active' && device.status !== 'online') {
      throw new UnauthorizedException('Display device is not active');
    }
    return this.generateToken(device.id, {
      type: 'display',
      orgId: device.orgId,
      branchId: device.branchId,
      deviceType: device.type,
    });
  }

  async generateUserToken(userId: string, orgId: string): Promise<string> {
    return this.generateToken(userId, { type: 'user', orgId });
  }

  verifyDisplaySessionToken(token: string): { deviceId: string } {
    const secret = this.config.get<string>('app.jwt.secret');
    try {
      const payload = this.jwtService.verify<{ did?: string; typ?: string }>(token, { secret });
      if (!payload?.did || payload.typ !== 'display') {
        throw new UnauthorizedException('Invalid display session token');
      }
      return { deviceId: payload.did };
    } catch (error: any) {
      this.logger.error(`Failed to verify display session token: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired display session token');
    }
  }

  isValidWebhookAuth(headerToken: string | undefined): boolean {
    const configured = this.config.get<string>('app.centrifugo.webhookSecret');
    if (!configured) {
      const isProd = this.config.get<string>('app.nodeEnv') === 'production';
      return !isProd;
    }
    if (!headerToken) return false;
    const expected = Buffer.from(configured);
    const provided = Buffer.from(headerToken);
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }

  async authorizeSubscription(params: {
    channel: string;
    userId: string;
    info?: Record<string, any>;
  }): Promise<boolean> {
    const { channel, info } = params;
    const [namespace, target] = channel.split(':');
    if (!namespace || !target) return false;

    const tokenOrgId = typeof info?.orgId === 'string' ? info.orgId : null;
    const tokenBranchId = typeof info?.branchId === 'string' ? info.branchId : null;
    const tokenType = typeof info?.type === 'string' ? info.type : null;

    if (namespace === 'display') {
      return (
        (tokenType === 'display' || tokenType === 'kiosk') &&
        tokenBranchId === target &&
        Boolean(tokenOrgId)
      );
    }

    if (namespace === 'org' || namespace === 'notifications') {
      return tokenOrgId === target;
    }

    if (namespace === 'queue') {
      if (!tokenOrgId) return false;
      const queue = await this.prisma.withBypassRls((tx) =>
        tx.queue.findUnique({
          where: { id: target },
          select: { orgId: true },
        }),
      );
      return !!queue && queue.orgId === tokenOrgId;
    }

    return false;
  }

  /**
   * Publishes a message to a Centrifugo channel.
   */
  async publish(channel: string, data: any) {
    const apiUrl = this.config.get<string>('app.centrifugo.apiUrl');
    const apiKey = this.config.get<string>('app.centrifugo.apiKey');

    if (!apiUrl || !apiKey) return;

    try {
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `apikey ${apiKey}`,
        },
        body: JSON.stringify({
          method: 'publish',
          params: { channel, data },
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to publish to Centrifugo: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handles Centrifugo presence webhooks (connect/disconnect).
   */
  async handlePresenceWebhook(event: 'connect' | 'disconnect', userId: string) {
    // Check if this userId is a display device ID
    // Display device IDs are UUIDs, while user IDs might be too.
    // We'll attempt to update the display device status if it exists.

    const isDisplayDevice = await this.prisma.withBypassRls((tx) =>
      tx.displayDevice.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
    );

    if (isDisplayDevice) {
      const status = event === 'connect' ? 'online' : 'offline';
      await this.prisma.withBypassRls((tx) =>
        tx.displayDevice.update({
          where: { id: userId },
          data: {
            status,
            lastSeenAt: new Date(),
          },
        }),
      );
      this.logger.log(`Display device ${userId} is now ${status} (via WebSocket)`);
    }
  }
}
