import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { isPlatformOperator } from '../../common/platform-operator.util';
import type { JwtPayload } from './jwt.strategy';
import { BCRYPT_ROUNDS, generateToken, sha256 } from './auth-token.util';

export { BCRYPT_ROUNDS, generateToken, sha256 };

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  async generateTokenPair(userId: string, orgId: string, orgSlug: string, email: string) {
    const payload: JwtPayload = { sub: userId, userId, orgId, orgSlug, email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: `${this.configService.get<number>('app.jwt.accessTtl') || 900}s`,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwt.refreshSecret'),
      expiresIn: `${this.configService.get<number>('app.jwt.refreshTtl') || 2592000}s`,
    });

    const context = this.requestContext.getContext();
    const tokenHash = sha256(refreshToken);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
        expiresAt: new Date(
          Date.now() + (this.configService.get<number>('app.jwt.refreshTtl') || 604800) * 1000,
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<number>('app.jwt.accessTtl') || 900,
    };
  }

  /**
   * Matches a raw refresh token against the list of active sessions.
   *
   * Uses SHA-256 exact matching for token verification.
   */
  async findMatchingSession(
    sessions: Array<{ id: string; tokenHash: string }>,
    refreshToken: string,
  ): Promise<{ id: string; tokenHash: string } | null> {
    const exactHash = sha256(refreshToken);

    for (const session of sessions) {
      if (session.tokenHash === exactHash) {
        return session;
      }
    }

    return null;
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
      });

      const user = await this.prisma.withBypassRls((tx) =>
        tx.user.findUnique({
          where: { id: payload.sub },
        }),
      );

      if (!user || user.status === 'suspended') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const activeSessions = await this.prisma.session.findMany({
        where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, tokenHash: true },
      });

      const matchedSession = await this.findMatchingSession(activeSessions, refreshToken);

      if (!matchedSession) {
        throw new UnauthorizedException('Session expired or revoked — please log in again');
      }

      await this.prisma.session.update({
        where: { id: matchedSession.id },
        data: { revokedAt: new Date() },
      });

      const org = await this.prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { slug: true },
      });
      const orgSlug = org?.slug ?? '';
      const tokens = await this.generateTokenPair(user.id, user.orgId, orgSlug, user.email);
      return {
        ...tokens,
        platformOperator: isPlatformOperator(user.id, user.email, orgSlug),
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
