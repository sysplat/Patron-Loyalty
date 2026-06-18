import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { isPlatformOperator } from '../../common/platform-operator.util';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { RedisService } from '../../redis/redis.service';
import { AuthUserCacheService, type CachedAuthUser } from './auth-user-cache.service';

export interface JwtPayload {
  sub: string; // userId
  userId: string; // the validate method maps sub to userId
  id?: string; // occasionally referenced in controllers
  orgId: string;
  orgSlug: string;
  email: string;
  /** When true with actAsOrgId, operator is viewing another tenant (RBAC bypass). */
  imp?: boolean;
  actAsOrgId?: string;
  /** Simulated tenant role — when set, RBAC is enforced for this role instead of bypass. */
  actAsRole?: string;
  /** Branch scope for manager/staff/viewer simulation. */
  actAsBranchId?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private requestContext: RequestContextService,
    private redis: RedisService,
    private userCache: AuthUserCacheService,
  ) {
    const jwtSecret = configService.get<string>('app.jwt.secret');
    if (!jwtSecret) {
      throw new Error('app.jwt.secret is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.resolveUser(payload.sub);

    if (!user || user.status === 'suspended') {
      throw new UnauthorizedException('Your account has been suspended.');
    }

    if (user.organization?.status === 'suspended') {
      throw new UnauthorizedException('Your organization has been suspended.');
    }

    const orgSlugFromDb = user.organization?.slug ?? payload.orgSlug;

    if (payload.imp === true && payload.actAsOrgId) {
      const targetOrg = await this.prisma.organization.findUnique({
        where: { id: payload.actAsOrgId },
        select: { id: true },
      });
      if (!targetOrg) {
        throw new UnauthorizedException('Impersonation target organization not found');
      }
      if (!isPlatformOperator(user.id, user.email, orgSlugFromDb)) {
        throw new UnauthorizedException('Impersonation is only for platform operators');
      }
      if (payload.jti) {
        const isBlacklisted = await this.redis.get(`auth:blacklist:${payload.jti}`);
        if (isBlacklisted) {
          throw new UnauthorizedException('Impersonation session has ended');
        }
      }
      this.requestContext.setUserId(user.id);
      this.requestContext.setOrgId(payload.actAsOrgId);
      return {
        userId: user.id,
        orgId: payload.actAsOrgId,
        orgSlug: orgSlugFromDb,
        email: user.email,
        impersonation: true as const,
        actAsRole: payload.actAsRole,
        actAsBranchId: payload.actAsBranchId,
        jti: payload.jti,
      };
    }

    this.requestContext.setUserId(user.id);
    this.requestContext.setOrgId(user.orgId);
    return {
      userId: user.id,
      orgId: user.orgId,
      orgSlug: orgSlugFromDb,
      email: user.email,
    };
  }

  /**
   * Loads the minimal auth user from Redis when available, otherwise from
   * Postgres (with transient-retry) and back-fills the cache. See
   * {@link AuthUserCacheService} for the staleness/invalidation contract.
   */
  private async resolveUser(userId: string): Promise<CachedAuthUser | null> {
    const cached = await this.userCache.get(userId);
    if (cached) return cached;

    const user = await this.prisma.runWithTransientRetry(() =>
      this.prisma.withBypassRls((tx) =>
        tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            orgId: true,
            email: true,
            status: true,
            organization: { select: { status: true, slug: true } },
          },
        }),
      ),
    );

    if (user) await this.userCache.set(user);
    return user;
  }
}
