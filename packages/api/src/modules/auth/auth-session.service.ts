import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { isPlatformOperator } from '../../common/platform-operator.util';
import { AUTH_AUDIT_EVENTS, recordAuthAudit } from './auth-security-audit';

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly platformAudit?: PlatformAuditService,
  ) {}

  async logout(userId: string) {
    const user = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, orgId: true },
      }),
    );

    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.logout,
      email: user?.email ?? 'unknown',
      actorUserId: userId,
      subjectOrgId: user?.orgId ?? null,
      outcome: 'success',
    });
    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.sessionsRevoked,
      email: user?.email ?? 'unknown',
      actorUserId: userId,
      subjectOrgId: user?.orgId ?? null,
      outcome: 'success',
      metadata: { reason: 'logout' },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Tenant web: platform operator flag for the current JWT (internal org + optional env allowlist).
   */
  async getSessionProfile(userId: string) {
    const row = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          organization: { select: { slug: true } },
        },
      }),
    );
    if (!row) {
      throw new UnauthorizedException('User not found');
    }
    const slug = row.organization?.slug ?? '';
    return {
      platformOperator: isPlatformOperator(row.id, row.email ?? '', slug),
    };
  }
}
