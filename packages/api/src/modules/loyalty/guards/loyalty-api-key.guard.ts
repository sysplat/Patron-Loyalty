import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoyaltyApiKeyService } from '../loyalty-api-key.service';

export const LOYALTY_ORG_ID_REQUEST_KEY = 'loyaltyOrgId';

@Injectable()
export class LoyaltyApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: LoyaltyApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-loyalty-api-key'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw || typeof raw !== 'string') {
      throw new UnauthorizedException('Missing X-Loyalty-Api-Key header');
    }

    const orgId = await this.apiKeys.resolveOrgId(raw);
    if (!orgId) {
      throw new UnauthorizedException('Invalid loyalty API key');
    }

    request[LOYALTY_ORG_ID_REQUEST_KEY] = orgId;
    return true;
  }
}
