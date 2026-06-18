import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SYSTEM_ROLES, passwordSchema } from '@queueplatform/shared';
import { AuditService } from '../../common/audit/audit.service';
import { BCRYPT_ROUNDS, generateToken, sha256 } from './auth-token.util';

@Injectable()
export class AuthPasswordService {
  private readonly logger = new Logger(AuthPasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async forgotPassword(email: string) {
    const user = await this.prisma.withBypassRls((tx) =>
      tx.user.findFirst({
        where: { email: email.toLowerCase() },
        include: { organization: { select: { status: true } } },
      }),
    );

    // Always return success to prevent email enumeration
    if (!user) return { message: 'If the email exists, a reset link has been sent' };

    if (user.status === 'suspended') {
      return { message: 'If the email exists, a reset link has been sent' };
    }
    if (user.organization.status === 'suspended') {
      return { message: 'If the email exists, a reset link has been sent' };
    }
    if (!user.emailVerified) {
      return { message: 'If the email exists, a reset link has been sent' };
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
      return { message: 'If the email exists, a reset link has been sent' };
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
    await this.notificationService
      .send(user.orgId, {
        channel: 'email',
        to: user.email,
        subject: 'Reset your password — QlessQ',
        body: [
          `Hello ${user.firstName || ''},`,
          '',
          'You requested a password reset. Click the link below to set a new password:',
          '',
          resetLink,
          '',
          'This link expires in 1 hour. If you did not request this, you can safely ignore this email.',
          '',
          '— The QlessQ Team',
        ].join('\n'),
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to queue password reset email: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });

    // Dev: return token directly so the flow works without SMTP
    const devPayload = process.env.NODE_ENV !== 'production' ? { resetToken } : {};
    return { message: 'If the email exists, a reset link has been sent', ...devPayload };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = sha256(token);
    const matched = await this.prisma.passwordReset.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!matched) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof Error) {
        throw new BadRequestException(err.message);
      }
      throw new BadRequestException('Invalid password format');
    }

    const target = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id: matched.userId },
        select: {
          accountId: true,
          orgId: true,
          twoFactorEnabled: true,
          adminTwoFactorEnabled: true,
        },
      }),
    );
    if (!target) {
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

    return { message: 'Password reset successfully', twoFactorCleared };
  }
}
