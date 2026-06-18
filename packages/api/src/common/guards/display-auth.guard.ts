import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export interface DisplayTokenPayload {
  /** Display device ID */
  did: string;
  /** Organization ID */
  oid: string;
  /** Branch ID */
  bid: string;
  /** Token type marker */
  typ: 'display';
  iat?: number;
  exp?: number;
}

/**
 * Guard for display-device-authenticated endpoints.
 * Validates the `X-Display-Token` header containing a signed JWT issued during pairing.
 *
 * Checks:
 * 1. JWT signature validity (using the same secret as user JWTs)
 * 2. Token type marker (`typ === 'display'`)
 * 3. Device still exists and is 'online' (not revoked/deleted)
 * 4. Result is cached in Redis for 60s to avoid DB lookups on every poll
 */
@Injectable()
export class DisplayAuthGuard implements CanActivate {
  private readonly logger = new Logger(DisplayAuthGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-display-token'] as string | undefined;

    if (!token) {
      throw new UnauthorizedException('Missing X-Display-Token header');
    }

    let payload: DisplayTokenPayload;
    try {
      payload = this.jwtService.verify<DisplayTokenPayload>(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Display token expired — re-authenticate with your API key',
        );
      }
      throw new UnauthorizedException('Invalid display token');
    }

    if (payload.typ !== 'display') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check revocation cache (positive cache: device known-good for 60s)
    const cacheKey = `display:auth:${payload.did}`;
    const cached = await this.redis.getJson<{ orgId: string; branchId: string; status: string }>(
      cacheKey,
    );

    if (cached) {
      if (cached.status !== 'online' && cached.status !== 'paired') {
        throw new UnauthorizedException('Display device has been revoked');
      }
      // Attach display context to request
      request.displayDevice = { id: payload.did, orgId: cached.orgId, branchId: cached.branchId };
      return true;
    }

    // Cache miss: verify against DB
    const device = await this.prisma.withBypassRls((tx) =>
      tx.displayDevice.findUnique({
        where: { id: payload.did },
        select: { id: true, orgId: true, branchId: true, status: true },
      }),
    );

    const activeStatuses = new Set(['online', 'paired']);
    if (!device || !activeStatuses.has(device.status)) {
      throw new UnauthorizedException('Display device not found or revoked');
    }

    if (device.orgId !== payload.oid) {
      throw new UnauthorizedException('Token organization mismatch');
    }

    // Cache the positive result for 60s
    await this.redis.setJson(
      cacheKey,
      { orgId: device.orgId, branchId: device.branchId, status: device.status },
      60,
    );

    // Attach display context to request
    request.displayDevice = { id: device.id, orgId: device.orgId, branchId: device.branchId };
    return true;
  }
}
