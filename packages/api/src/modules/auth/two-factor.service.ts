import { BadRequestException, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import {
  buildOtpauthUrl,
  generateTotpSecret,
  generateBackupCodes,
  verifyTotp,
} from './two-factor.util';
import {
  loadAdminTwoFactorMemberships,
  syncAdminTwoFactorToMemberships,
} from './admin-two-factor-account.util';
import { AUTH_AUDIT_EVENTS, recordAuthAudit } from './auth-security-audit';

const BCRYPT_ROUNDS = 12;

/** Org app (tenant) vs Platform Admin app — separate TOTP secrets. */
export type TotpChannel = 'organization' | 'admin_dashboard';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly platformAudit?: PlatformAuditService,
  ) {}

  /** Auth paths resolve users before tenant RLS context is established. */
  private bypass<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withBypassRls(fn);
  }

  /** User writes under RLS require matching app.current_org_id (reads may use bypass alone). */
  private bypassUserWrite<T>(orgId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withBypassRls(fn, { orgId });
  }

  async getStatus(userId: string, issuer?: string, channel: TotpChannel = 'organization') {
    if (channel === 'admin_dashboard') {
      const resolved = await this.bypass((tx) => loadAdminTwoFactorMemberships(tx, userId));
      if (!resolved) throw new BadRequestException('User not found');
      const iss = issuer ?? 'QPlatform Admin';
      return {
        enabled: resolved.enabled,
        enrollmentPending: resolved.enrollmentPending,
        setup:
          resolved.enrollmentPending && resolved.secret
            ? {
                secret: resolved.secret,
                otpauthUrl: buildOtpauthUrl(resolved.email, resolved.secret, iss),
              }
            : null,
      };
    }

    const u = await this.bypass((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
        },
      }),
    );
    if (!u) throw new BadRequestException('User not found');
    const enrollmentPending = Boolean(u.twoFactorSecret && !u.twoFactorEnabled);

    return {
      enabled: u.twoFactorEnabled,
      enrollmentPending,
      setup: enrollmentPending
        ? {
            secret: u.twoFactorSecret!,
            otpauthUrl: buildOtpauthUrl(u.email, u.twoFactorSecret!, issuer),
          }
        : null,
    };
  }

  /** Begin enrollment: store pending secret (enabled stays false until verified). */
  async beginSetup(userId: string, issuer?: string, channel: TotpChannel = 'organization') {
    if (channel === 'admin_dashboard') {
      const resolved = await this.bypass((tx) => loadAdminTwoFactorMemberships(tx, userId));
      if (!resolved) throw new BadRequestException('User not found');
      if (resolved.enabled) {
        throw new BadRequestException('Two-factor authentication is already enabled');
      }
      const secret = generateTotpSecret();
      await this.bypass((tx) =>
        syncAdminTwoFactorToMemberships(tx, resolved.memberships, {
          adminTwoFactorSecret: secret,
          adminTwoFactorEnabled: false,
          adminTwoFactorBackupHashes: Prisma.DbNull,
        }),
      );
      const iss = issuer ?? 'QPlatform Admin';
      return { secret, otpauthUrl: buildOtpauthUrl(resolved.email, secret, iss) };
    }

    const u = await this.bypass((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { email: true, orgId: true, twoFactorEnabled: true },
      }),
    );
    if (!u) throw new BadRequestException('User not found');
    if (u.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }
    const secret = generateTotpSecret();
    await this.bypassUserWrite(u.orgId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: secret,
          twoFactorEnabled: false,
          twoFactorBackupHashes: Prisma.DbNull,
        },
      }),
    );
    return {
      secret,
      otpauthUrl: buildOtpauthUrl(u.email, secret, issuer),
    };
  }

  /** Confirm enrollment with a valid TOTP code; returns one-time backup codes. */
  async enable(userId: string, code: string, channel: TotpChannel = 'organization') {
    if (channel === 'admin_dashboard') {
      const resolved = await this.bypass((tx) => loadAdminTwoFactorMemberships(tx, userId));
      if (!resolved?.secret) {
        throw new BadRequestException('Run setup first to generate a secret');
      }
      if (resolved.enabled) {
        throw new BadRequestException('Two-factor authentication is already enabled');
      }
      if (!verifyTotp(resolved.secret, code)) {
        await recordAuthAudit(this.platformAudit, {
          eventType: AUTH_AUDIT_EVENTS.twoFactorEnabled,
          email: resolved.email,
          actorUserId: userId,
          subjectOrgId: resolved.memberships[0]?.orgId ?? null,
          severity: 'warning',
          outcome: 'invalid_2fa_code',
          metadata: { channel, stage: 'enable' },
        });
        throw new UnauthorizedException('Invalid authenticator code');
      }
      const plainCodes = generateBackupCodes(8);
      const hashes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
      await this.bypass((tx) =>
        syncAdminTwoFactorToMemberships(tx, resolved.memberships, {
          adminTwoFactorEnabled: true,
          adminTwoFactorBackupHashes: hashes,
        }),
      );
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.twoFactorEnabled,
        email: resolved.email,
        actorUserId: userId,
        subjectOrgId: resolved.memberships[0]?.orgId ?? null,
        outcome: 'success',
        metadata: { channel },
      });
      return { backupCodes: plainCodes };
    }

    const u = await this.bypass((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { email: true, orgId: true, twoFactorSecret: true, twoFactorEnabled: true },
      }),
    );
    if (!u?.twoFactorSecret) {
      throw new BadRequestException('Run setup first to generate a secret');
    }
    if (u.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }
    if (!verifyTotp(u.twoFactorSecret, code)) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.twoFactorEnabled,
        email: u.email,
        actorUserId: userId,
        subjectOrgId: u.orgId,
        severity: 'warning',
        outcome: 'invalid_2fa_code',
        metadata: { channel, stage: 'enable' },
      });
      throw new UnauthorizedException('Invalid authenticator code');
    }
    const plainCodes = generateBackupCodes(8);
    const hashes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
    await this.bypassUserWrite(u.orgId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorBackupHashes: hashes,
        },
      }),
    );
    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.twoFactorEnabled,
      email: u.email,
      actorUserId: userId,
      subjectOrgId: u.orgId,
      outcome: 'success',
      metadata: { channel },
    });
    return { backupCodes: plainCodes };
  }

  async disable(
    userId: string,
    password: string,
    code: string,
    channel: TotpChannel = 'organization',
  ) {
    if (channel === 'admin_dashboard') {
      const resolved = await this.bypass((tx) =>
        tx.user
          .findUnique({
            where: { id: userId },
            select: { passwordHash: true },
          })
          .then(async (u) => {
            if (!u) return null;
            const admin = await loadAdminTwoFactorMemberships(tx, userId);
            return admin ? { passwordHash: u.passwordHash, admin } : null;
          }),
      );
      if (!resolved?.admin.enabled) {
        throw new BadRequestException('Two-factor authentication is not enabled');
      }
      const ok = await bcrypt.compare(password, resolved.passwordHash);
      if (!ok) {
        await recordAuthAudit(this.platformAudit, {
          eventType: AUTH_AUDIT_EVENTS.twoFactorDisabled,
          email: resolved.admin.email,
          actorUserId: userId,
          subjectOrgId: resolved.admin.memberships[0]?.orgId ?? null,
          severity: 'warning',
          outcome: 'wrong_current_password',
          metadata: { channel, stage: 'disable' },
        });
        throw new BadRequestException('Invalid password');
      }

      const normalized = code.replace(/\s/g, '');
      const totpOk = resolved.admin.secret ? verifyTotp(resolved.admin.secret, normalized) : false;
      let backupOk = false;
      if (!totpOk && Array.isArray(resolved.admin.backupHashes)) {
        const hashes = resolved.admin.backupHashes as string[];
        for (const h of hashes) {
          const match = await bcrypt.compare(normalized, h).catch(() => false);
          if (match) {
            backupOk = true;
            break;
          }
        }
      }
      if (!totpOk && !backupOk) {
        await recordAuthAudit(this.platformAudit, {
          eventType: AUTH_AUDIT_EVENTS.twoFactorDisabled,
          email: resolved.admin.email,
          actorUserId: userId,
          subjectOrgId: resolved.admin.memberships[0]?.orgId ?? null,
          severity: 'warning',
          outcome: 'invalid_2fa_code',
          metadata: { channel, stage: 'disable' },
        });
        throw new BadRequestException('Invalid authenticator or backup code');
      }

      await this.bypass((tx) =>
        syncAdminTwoFactorToMemberships(tx, resolved.admin.memberships, {
          adminTwoFactorSecret: null,
          adminTwoFactorEnabled: false,
          adminTwoFactorBackupHashes: Prisma.DbNull,
        }),
      );
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.twoFactorDisabled,
        email: resolved.admin.email,
        actorUserId: userId,
        subjectOrgId: resolved.admin.memberships[0]?.orgId ?? null,
        outcome: 'success',
        metadata: { channel },
      });
      return { disabled: true };
    }

    const u = await this.bypass((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          orgId: true,
          passwordHash: true,
          twoFactorSecret: true,
          twoFactorEnabled: true,
          twoFactorBackupHashes: true,
        },
      }),
    );
    if (!u || !u.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.twoFactorDisabled,
        email: u.email,
        actorUserId: userId,
        subjectOrgId: u.orgId,
        severity: 'warning',
        outcome: 'wrong_current_password',
        metadata: { channel, stage: 'disable' },
      });
      throw new BadRequestException('Invalid password');
    }

    const normalized = code.replace(/\s/g, '');
    const totpOk = u.twoFactorSecret ? verifyTotp(u.twoFactorSecret, normalized) : false;
    let backupOk = false;
    if (!totpOk && Array.isArray(u.twoFactorBackupHashes)) {
      const hashes = u.twoFactorBackupHashes as string[];
      for (const h of hashes) {
        const match = await bcrypt.compare(normalized, h).catch(() => false);
        if (match) {
          backupOk = true;
          break;
        }
      }
    }
    if (!totpOk && !backupOk) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.twoFactorDisabled,
        email: u.email,
        actorUserId: userId,
        subjectOrgId: u.orgId,
        severity: 'warning',
        outcome: 'invalid_2fa_code',
        metadata: { channel, stage: 'disable' },
      });
      throw new BadRequestException('Invalid authenticator or backup code');
    }

    await this.bypassUserWrite(u.orgId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: null,
          twoFactorEnabled: false,
          twoFactorBackupHashes: Prisma.DbNull,
        },
      }),
    );
    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.twoFactorDisabled,
      email: u.email,
      actorUserId: userId,
      subjectOrgId: u.orgId,
      outcome: 'success',
      metadata: { channel },
    });
    return { disabled: true };
  }

  /** Abandon pending enrollment (secret stored but 2FA not yet enabled). */
  async cancelSetup(userId: string, channel: TotpChannel = 'organization') {
    if (channel === 'admin_dashboard') {
      const resolved = await this.bypass((tx) => loadAdminTwoFactorMemberships(tx, userId));
      if (!resolved) throw new BadRequestException('User not found');
      if (resolved.enabled) {
        throw new BadRequestException('Two-factor authentication is already enabled');
      }
      if (!resolved.secret) {
        return { cancelled: true as const };
      }
      await this.bypass((tx) =>
        syncAdminTwoFactorToMemberships(tx, resolved.memberships, {
          adminTwoFactorSecret: null,
          adminTwoFactorBackupHashes: Prisma.DbNull,
        }),
      );
      return { cancelled: true as const };
    }

    const u = await this.bypass((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { orgId: true, twoFactorEnabled: true, twoFactorSecret: true },
      }),
    );
    if (!u) throw new BadRequestException('User not found');
    if (u.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }
    if (!u.twoFactorSecret) {
      return { cancelled: true as const };
    }
    await this.bypassUserWrite(u.orgId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: null,
          twoFactorBackupHashes: Prisma.DbNull,
        },
      }),
    );
    return { cancelled: true as const };
  }

  /** Replace backup codes; requires password + current TOTP (not a backup code). */
  async regenerateBackupCodes(
    userId: string,
    password: string,
    totpCode: string,
    channel: TotpChannel = 'organization',
  ) {
    if (channel === 'admin_dashboard') {
      const resolved = await this.bypass((tx) =>
        tx.user
          .findUnique({
            where: { id: userId },
            select: { passwordHash: true },
          })
          .then(async (u) => {
            if (!u) return null;
            const admin = await loadAdminTwoFactorMemberships(tx, userId);
            return admin ? { passwordHash: u.passwordHash, admin } : null;
          }),
      );
      if (!resolved) throw new BadRequestException('User not found');
      if (!resolved.admin.enabled || !resolved.admin.secret) {
        throw new BadRequestException('Two-factor authentication is not enabled');
      }
      const ok = await bcrypt.compare(password, resolved.passwordHash);
      if (!ok) {
        await recordAuthAudit(this.platformAudit, {
          eventType: AUTH_AUDIT_EVENTS.twoFactorBackupRegenerated,
          email: resolved.admin.email,
          actorUserId: userId,
          subjectOrgId: resolved.admin.memberships[0]?.orgId ?? null,
          severity: 'warning',
          outcome: 'wrong_current_password',
          metadata: { channel },
        });
        throw new BadRequestException('Invalid password');
      }
      const normalized = totpCode.replace(/\s/g, '');
      if (!verifyTotp(resolved.admin.secret, normalized)) {
        await recordAuthAudit(this.platformAudit, {
          eventType: AUTH_AUDIT_EVENTS.twoFactorBackupRegenerated,
          email: resolved.admin.email,
          actorUserId: userId,
          subjectOrgId: resolved.admin.memberships[0]?.orgId ?? null,
          severity: 'warning',
          outcome: 'invalid_2fa_code',
          metadata: { channel },
        });
        throw new UnauthorizedException('Invalid authenticator code');
      }
      const plainCodes = generateBackupCodes(8);
      const hashes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
      await this.bypass((tx) =>
        syncAdminTwoFactorToMemberships(tx, resolved.admin.memberships, {
          adminTwoFactorBackupHashes: hashes,
        }),
      );
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.twoFactorBackupRegenerated,
        email: resolved.admin.email,
        actorUserId: userId,
        subjectOrgId: resolved.admin.memberships[0]?.orgId ?? null,
        outcome: 'success',
        metadata: { channel },
      });
      return { backupCodes: plainCodes };
    }

    const u = await this.bypass((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          orgId: true,
          passwordHash: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
        },
      }),
    );
    if (!u) throw new BadRequestException('User not found');
    if (!u.twoFactorEnabled || !u.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.twoFactorBackupRegenerated,
        email: u.email,
        actorUserId: userId,
        subjectOrgId: u.orgId,
        severity: 'warning',
        outcome: 'wrong_current_password',
        metadata: { channel },
      });
      throw new BadRequestException('Invalid password');
    }
    const normalized = totpCode.replace(/\s/g, '');
    if (!verifyTotp(u.twoFactorSecret, normalized)) {
      await recordAuthAudit(this.platformAudit, {
        eventType: AUTH_AUDIT_EVENTS.twoFactorBackupRegenerated,
        email: u.email,
        actorUserId: userId,
        subjectOrgId: u.orgId,
        severity: 'warning',
        outcome: 'invalid_2fa_code',
        metadata: { channel },
      });
      throw new UnauthorizedException('Invalid authenticator code');
    }
    const plainCodes = generateBackupCodes(8);
    const hashes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
    await this.bypassUserWrite(u.orgId, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: { twoFactorBackupHashes: hashes },
      }),
    );
    await recordAuthAudit(this.platformAudit, {
      eventType: AUTH_AUDIT_EVENTS.twoFactorBackupRegenerated,
      email: u.email,
      actorUserId: userId,
      subjectOrgId: u.orgId,
      outcome: 'success',
      metadata: { channel },
    });
    return { backupCodes: plainCodes };
  }
}
