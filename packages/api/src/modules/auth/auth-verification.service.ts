import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { sha256 } from './auth-token.util';
import { AUTH_AUDIT_EVENTS, recordAuthAudit } from './auth-security-audit';

@Injectable()
export class AuthVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly platformAudit?: PlatformAuditService,
  ) {}

  async verifyEmail(token: string) {
    const tokenHash = sha256(token);
    const matched = await this.prisma.withBypassRls(async (tx) => {
      return tx.emailVerification.findFirst({
        where: { tokenHash, verifiedAt: null, expiresAt: { gt: new Date() } },
        include: { user: { include: { organization: true, account: true } } },
      });
    });

    if (!matched) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.emailVerifyFailed,
        email: 'unknown',
        outcome: 'invalid_verify_token',
      });
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.withBypassRls(
      async (tx) => {
        await tx.emailVerification.update({
          where: { id: matched.id },
          data: { verifiedAt: new Date() },
        });
        await tx.user.update({
          where: { id: matched.userId },
          data: { emailVerified: true, status: 'active' },
        });
        if (matched.user.accountId) {
          await tx.account.update({
            where: { id: matched.user.accountId },
            data: { emailVerified: true },
          });
        }
        await tx.organization.update({
          where: { id: matched.user.orgId },
          data: { onboardingStep: 'service_selection' },
        });
      },
      { orgId: matched.user.orgId },
    );

    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.emailVerified,
      email: matched.user.email,
      actorUserId: matched.userId,
      subjectOrgId: matched.user.orgId,
      outcome: 'success',
      metadata: { orgSlug: matched.user.organization?.slug },
    });

    return { message: 'Email verified successfully' };
  }
}
