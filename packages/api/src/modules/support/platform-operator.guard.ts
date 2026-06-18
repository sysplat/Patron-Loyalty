import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isPlatformOperator } from '../../common/platform-operator.util';
import { PrismaService } from '../../prisma/prisma.service';
import { BYPASS_TWO_FACTOR_KEY } from '../../common/decorators/bypass-two-factor.decorator';
import { loadAdminTwoFactorMemberships } from '../auth/admin-two-factor-account.util';

@Injectable()
export class PlatformOperatorGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { userId?: string; id?: string; email?: string; orgSlug?: string }
      | undefined;
    const userId = user?.userId ?? user?.id ?? null;
    const tokenEmail = String(user?.email ?? '');

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const dbUser = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          organization: { select: { slug: true } },
        },
      }),
    );
    if (!dbUser) {
      throw new UnauthorizedException('Authentication required');
    }

    const adminTwoFactor = await this.prisma.withBypassRls((tx) =>
      loadAdminTwoFactorMemberships(tx, userId),
    );

    const resolvedEmail = String(dbUser.email ?? tokenEmail ?? '').trim();
    const resolvedSlug = String(dbUser.organization?.slug ?? user?.orgSlug ?? '').trim();

    if (!isPlatformOperator(userId, resolvedEmail, resolvedSlug)) {
      throw new ForbiddenException('Platform operator access required');
    }

    const bypass2FA = this.reflector.getAllAndOverride<boolean>(BYPASS_TWO_FACTOR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!bypass2FA) {
      if (!adminTwoFactor?.enabled) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Admin Dashboard two-factor authentication is required',
          code: 'TWO_FACTOR_REQUIRED',
        });
      }
    }

    return true;
  }
}
