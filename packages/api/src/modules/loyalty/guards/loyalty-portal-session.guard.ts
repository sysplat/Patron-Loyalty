import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import {
  LoyaltyPortalAuthService,
  type LoyaltyPortalTokenPayload,
} from '../loyalty-portal-auth.service';

export const PortalSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): LoyaltyPortalTokenPayload => {
    const request = ctx.switchToHttp().getRequest<{ portalSession?: LoyaltyPortalTokenPayload }>();
    if (!request.portalSession) {
      throw new UnauthorizedException('Portal session required');
    }
    return request.portalSession;
  },
);

@Injectable()
export class LoyaltyPortalSessionGuard implements CanActivate {
  constructor(private readonly portalAuth: LoyaltyPortalAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      params: { referralCode?: string };
      portalSession?: LoyaltyPortalTokenPayload;
    }>();
    const auth = request.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException('Verify your phone to continue');
    }
    const referralCode = request.params.referralCode ?? '';
    request.portalSession = this.portalAuth.verifyPortalToken(token, referralCode);
    return true;
  }
}
