import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SYSTEM_ROLES, passwordSchema } from '@queueplatform/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { BCRYPT_ROUNDS, generateToken, sha256 } from './auth-token.util';
import { AUTH_AUDIT_EVENTS, recordAuthAudit, type AuthAuditOutcome } from './auth-security-audit';

@Injectable()
export class AuthPasswordService {
  private readonly logger = new Logger(AuthPasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly audit: AuditService,
    @Optional() private readonly platformAudit?: PlatformAuditService,
  ) {}

  async forgotPassword(email: string) {
    const emailNorm = email.toLowerCase();
    const user = await this.prisma.withBypassRls((tx) =>
      tx.user.findFirst({
        where: { email: emailNorm },
        include: { organization: { select: { status: true, slug: true } } },
      }),
    );

    const publicOk = { message: 'If the email exists, a reset link has been sent' };

    // Always return success to prevent email enumeration
    if (!user) {
      const accountOnly = await this.prisma.account.findUnique({
        where: { email: emailNorm },
        select: { id: true },
      });
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
        email: emailNorm,
        severity: accountOnly ? 'warning' : 'info',
        outcome: accountOnly ? 'account_user_email_mismatch' : 'unknown_email',
        metadata: accountOnly ? { accountId: accountOnly.id } : undefined,
      });
      return publicOk;
    }

    if (user.status === 'suspended') {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
        email: emailNorm,
        actorUserId: user.id,
        subjectOrgId: user.orgId,
        severity: 'warning',
        outcome: 'user_suspended',
      });
      return publicOk;
    }
    if (user.organization.status === 'suspended') {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
        email: emailNorm,
        actorUserId: user.id,
        subjectOrgId: user.orgId,
        severity: 'warning',
        outcome: 'org_suspended',
        metadata: { orgSlug: user.organization.slug },
      });
      return publicOk;
    }
    if (!user.emailVerified) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
        email: emailNorm,
        actorUserId: user.id,
        subjectOrgId: user.orgId,
        severity: 'warning',
        outcome: 'email_unverified',
      });
      return publicOk;
    }

    const ownerAssignment = await this.prisma.withBypassRls((tx) =>
      tx.roleAssignment.findFirst({
        where: {
          userId: user.id,
          role: { orgId: user.orgId, name: SYSTEM_ROLES.OWNER },
        },
        select: { id: true },
      }),
    );
    if (!ownerAssignment) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
        email: emailNorm,
        actorUserId: user.id,
        subjectOrgId: user.orgId,
        severity: 'warning',
        outcome: 'not_owner',
        metadata: { orgSlug: user.organization.slug },
      });
      return publicOk;
    }

    // Invalidate any existing unused tokens before creating a new one
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const resetToken = generateToken();
    const tokenHash = sha256(resetToken);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Queue password reset email via BullMQ
    const appUrl = this.configService.get<string>('app.appUrl') || 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
    let emailOutcome: AuthAuditOutcome = 'email_queued';
    try {
      await this.notificationService.send(user.orgId, {
        channel: 'email',
        to: user.email,
        subject: 'Reset your password — QPlatform',
        body: [
          `Hello ${user.firstName || ''},`,
          '',
          'You requested a password reset. Click the link below to set a new password:',
          '',
          resetLink,
          '',
          'This link expires in 1 hour. If you did not request this, you can safely ignore this email.',
          '',
          '— The QPlatform Team',
        ].join('\n'),
      });
    } catch (err) {
      emailOutcome = 'email_queue_failed';
      this.logger.warn(
        `Failed to queue password reset email: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }

    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.passwordResetRequested,
      email: emailNorm,
      actorUserId: user.id,
      subjectOrgId: user.orgId,
      severity: emailOutcome === 'email_queue_failed' ? 'critical' : 'info',
      outcome: emailOutcome,
      metadata: { orgSlug: user.organization.slug },
    });

    // Dev: return token directly so the flow works without SMTP
    const devPayload = process.env.NODE_ENV !== 'production' ? { resetToken } : {};
    return { message: 'If the email exists, a reset link has been sent', ...devPayload };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = sha256(token);
    const matched = await this.prisma.runWithTransientRetry(() =>
      this.prisma.withBypassRls((tx) =>
        tx.passwordReset.findFirst({
          where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        }),
      ),
    );

    if (!matched) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.passwordResetFailed,
        email: 'unknown',
        outcome: 'invalid_reset_token',
      });
      throw new BadRequestException('Invalid or expired reset token');
    }

    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.passwordResetFailed,
        email: 'unknown',
        actorUserId: matched.userId,
        outcome: 'invalid_password_format',
      });
      if (err instanceof Error) {
        throw new BadRequestException(err.message);
      }
      throw new BadRequestException('Invalid password format');
    }

    const target = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id: matched.userId },
        select: {
          email: true,
          accountId: true,
          orgId: true,
          twoFactorEnabled: true,
          adminTwoFactorEnabled: true,
        },
      }),
    );
    if (!target) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.passwordResetFailed,
        email: 'unknown',
        actorUserId: matched.userId,
        outcome: 'invalid_reset_token',
        metadata: { reason: 'user_missing' },
      });
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    const passwordData = {
      passwordHash,
      status: 'active' as const,
      emailVerified: true,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupHashes: Prisma.DbNull,
      adminTwoFactorEnabled: false,
      adminTwoFactorSecret: null,
      adminTwoFactorBackupHashes: Prisma.DbNull,
    };

    await this.prisma.withBypassRls(
      async (tx) => {
        await tx.passwordReset.update({
          where: { id: matched.id },
          data: { usedAt: new Date() },
        });

        if (target.accountId) {
          await tx.account.update({
            where: { id: target.accountId },
            data: { passwordHash, emailVerified: true },
          });
          const siblings = await tx.user.findMany({
            where: { accountId: target.accountId },
            select: { id: true, orgId: true },
          });
          const orgIds = [...new Set(siblings.map((s) => s.orgId))];
          for (const orgId of orgIds) {
            await tx.$executeRaw(
              Prisma.sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
            );
            await tx.user.updateMany({
              where: { accountId: target.accountId, orgId },
              data: passwordData,
            });
          }
          await tx.session.updateMany({
            where: { userId: { in: siblings.map((s) => s.id) }, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        } else {
          await tx.user.update({
            where: { id: matched.userId },
            data: passwordData,
          });
          await tx.session.updateMany({
            where: { userId: matched.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      },
      { orgId: target.orgId },
    );

    const twoFactorCleared =
      target.twoFactorEnabled === true || target.adminTwoFactorEnabled === true;
    await this.audit.logActivity({
      orgId: target.orgId,
      userId: matched.userId,
      action: 'auth.password_reset',
      resourceType: 'user',
      resourceId: matched.userId,
      metadata: { twoFactorCleared } as Prisma.InputJsonObject,
    });
    await this.audit.logAudit({
      orgId: target.orgId,
      userId: matched.userId,
      action: 'password_reset',
      tableName: 'users',
      recordId: matched.userId,
      oldValues: { twoFactorEnabled: target.twoFactorEnabled } as Prisma.InputJsonObject,
      newValues: {
        twoFactorEnabled: false,
        twoFactorSecretCleared: true,
        twoFactorBackupHashesCleared: true,
      } as Prisma.InputJsonObject,
    });

    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.passwordResetCompleted,
      email: target.email,
      actorUserId: matched.userId,
      subjectOrgId: target.orgId,
      outcome: 'success',
      metadata: { twoFactorCleared },
    });
    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.sessionsRevoked,
      email: target.email,
      actorUserId: matched.userId,
      subjectOrgId: target.orgId,
      outcome: 'success',
      metadata: { reason: 'password_reset' },
    });

    return { message: 'Password reset successfully', twoFactorCleared };
  }
}
