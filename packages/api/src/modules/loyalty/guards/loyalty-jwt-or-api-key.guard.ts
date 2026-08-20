import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '../../auth/jwt.strategy';
import { LoyaltyApiKeyService } from '../loyalty-api-key.service';
import { LOYALTY_ORG_ID_REQUEST_KEY } from './loyalty-api-key.guard';

/**
 * Accepts dashboard JWT (Authorization: Bearer) or external X-Loyalty-Api-Key.
 * Sets {@link LOYALTY_ORG_ID_REQUEST_KEY} for {@link LoyaltyOrgId}.
 */
@Injectable()
export class LoyaltyJwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeys: LoyaltyApiKeyService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const header = request.headers['x-loyalty-api-key'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (raw && typeof raw === 'string') {
      const orgId = await this.apiKeys.resolveOrgId(raw);
      if (!orgId) {
        throw new UnauthorizedException('Invalid loyalty API key');
      }
      request[LOYALTY_ORG_ID_REQUEST_KEY] = orgId;
      return true;
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const secret = this.config.get<string>('app.jwt.secret');
      if (!secret) {
        throw new UnauthorizedException('Authentication is not configured');
      }
      try {
        const payload = this.jwtService.verify<JwtPayload>(token, { secret });
        const orgId = payload.actAsOrgId ?? payload.orgId;
        if (!orgId) {
          throw new UnauthorizedException('Invalid session');
        }
        request[LOYALTY_ORG_ID_REQUEST_KEY] = orgId;
        return true;
      } catch {
        throw new UnauthorizedException('Invalid or expired session');
      }
    }

    throw new UnauthorizedException('Missing authentication');
  }
}
