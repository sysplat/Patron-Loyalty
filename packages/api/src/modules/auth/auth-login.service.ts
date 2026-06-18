import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { syncSystemRolePermissions } from '../../common/rbac/system-role-permissions';
import { isPlatformOperator } from '../../common/platform-operator.util';
import { verifyTotp, compareBackupCode } from './two-factor.util';
import { AuthTokenService } from './auth-token.service';
import {
  loadAdminTwoFactorMemberships,
  syncAdminTwoFactorToMemberships,
} from './admin-two-factor-account.util';

@Injectable()
export class AuthLoginService {
  private readonly logger = new Logger(AuthLoginService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async login(
    email: string,
    password: string,
    orgId?: string,
    options?: { platformAdmin?: boolean },
  ) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }
    const platformAdmin = options?.platformAdmin === true;
    const emailNorm = email.toLowerCase();

    return this.prisma.runWithTransientRetry(async () => {
      // 1. Find the primary account for this email
      const account = await this.prisma.account.findUnique({
        where: { email: emailNorm },
      });

      let authenticatedAccountId: string | null = null;
      const legacyValidUserIds: string[] = [];

      if (account) {
        // Verify against the account record
        const passwordValid = await bcrypt.compare(password, account.passwordHash);
        if (passwordValid) {
          authenticatedAccountId = account.id;
        }
      }

      // 2. Also check legacy users without accounts (or in case password was changed only on user record)
      const usersWithEmail = await this.prisma.withBypassRls((tx) =>
        tx.user.findMany({
          where: { email: { equals: emailNorm, mode: 'insensitive' } },
          include: { organization: true, account: true },
        }),
      );

      if (usersWithEmail.length === 0 && !account) {
        throw new UnauthorizedException('Invalid email or password');
      }

      for (const u of usersWithEmail) {
        // Skip if already covered by account auth
        if (authenticatedAccountId && u.accountId === authenticatedAccountId) continue;

        // Check against user-specific hash (fallback)
        const passwordValid = await bcrypt.compare(password, u.passwordHash);
        if (passwordValid) {
          legacyValidUserIds.push(u.id);
        }
      }

      if (!authenticatedAccountId && legacyValidUserIds.length === 0) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // 3. Collect all "valid" memberships for this session
      // If the global account is authenticated, we trust ALL memberships for this email.
      // Otherwise, we only trust legacy memberships that matched the password.
      const pool = usersWithEmail.filter(
        (u) => authenticatedAccountId || legacyValidUserIds.includes(u.id),
      );

      // Filter for platform admin if requested
      const finalPool = platformAdmin
        ? pool.filter((u) => isPlatformOperator(u.id, u.email, u.organization.slug))
        : pool;

      if (finalPool.length === 0) {
        if (platformAdmin) {
          throw new UnauthorizedException('This sign-in is only for platform operators.');
        }
        throw new UnauthorizedException('Invalid email or password');
      }

      // 4. Resolve which user to log in as
      let user: (typeof finalPool)[0] | null;

      if (orgId) {
        user = finalPool.find((u) => u.orgId === orgId) ?? null;
        if (!user) {
          throw new UnauthorizedException(
            'The selected organization is not available for this account.',
          );
        }
      } else if (finalPool.length === 1) {
        user = finalPool[0];
      } else {
        // Multiple orgs found - trigger UI selection
        return {
          requiresOrgSelection: true,
          organizations: finalPool.map((u) => ({
            id: u.organization.id,
            name: u.organization.name,
            slug: u.organization.slug,
          })),
        };
      }

      const isDev = this.configService.get<string>('app.env') !== 'production';
      const resolvedEmailVerified = (user.account?.emailVerified ?? false) || user.emailVerified;
      if (!resolvedEmailVerified && !isDev) {
        throw new UnauthorizedException(
          'Your email address has not been verified. Please check your inbox for a verification link.',
        );
      }

      if (user.status === 'suspended') {
        throw new UnauthorizedException(
          'Your account has been suspended. Please contact your organization administrator.',
        );
      }

      if (user.organization.status === 'suspended') {
        throw new UnauthorizedException(
          'Your organization has been suspended. Please contact QlessQ support.',
        );
      }

      // Fetch primary role for frontend RBAC
      const roleAssignment = await this.prisma.withBypassRls((tx) =>
        tx.roleAssignment.findFirst({
          where: { userId: user.id },
          include: { role: { select: { name: true } } },
        }),
      );

      const roleName = roleAssignment?.role?.name ?? 'viewer';

      const isE2E = user.email.endsWith('@qms-e2e.test');
      const adminTwoFactor = platformAdmin
        ? await this.prisma.withBypassRls((tx) => loadAdminTwoFactorMemberships(tx, user.id))
        : null;
      const requiresTwoFactor = platformAdmin
        ? adminTwoFactor?.enabled === true && !isE2E
        : user.twoFactorEnabled === true && !isE2E;

      if (requiresTwoFactor) {
        const twoFactorTyp = platformAdmin ? '2fa_pending_admin' : '2fa_pending';
        const twoFactorToken = await this.jwtService.signAsync(
          { sub: user.id, typ: twoFactorTyp },
          {
            secret: this.configService.get<string>('app.jwt.secret'),
            expiresIn: 300,
          },
        );
        return {
          requiresTwoFactor: true as const,
          ...(platformAdmin ? { adminDashboardTwoFactor: true as const } : {}),
          twoFactorToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            orgId: user.orgId,
            emailVerified: resolvedEmailVerified,
            role: roleName,
            twoFactorEnabled: user.twoFactorEnabled,
            platformOperator: isPlatformOperator(user.id, user.email, user.organization.slug),
          },
          organization: {
            id: user.organization.id,
            name: user.organization.name,
            slug: user.organization.slug,
            onboardingStep: user.organization.onboardingStep,
            timezone: user.organization.timezone,
          },
        };
      }

      // 5. Update last login and ensure password sync if authenticated via legacy hash
      const dataToUpdate: { lastLoginAt: Date } = { lastLoginAt: new Date() };

      // If we have an account but authenticated via legacy user hash, sync it up
      if (account && !authenticatedAccountId && legacyValidUserIds.includes(user.id)) {
        this.logger.log(
          `Syncing password hash from legacy user ${user.id} to account ${account.id}`,
        );
        await this.prisma.account.update({
          where: { id: account.id },
          data: { passwordHash: user.passwordHash },
        });
      }

      await this.prisma.withBypassRls(
        (tx) =>
          tx.user.update({
            where: { id: user.id },
            data: dataToUpdate,
          }),
        { orgId: user.orgId },
      );

      // Lazy sync system roles for the organization (diff-aware)
      this.syncOrgRoles(user.orgId);

      const tokens = await this.authTokenService.generateTokenPair(
        user.id,
        user.orgId,
        user.organization.slug,
        user.email,
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          orgId: user.orgId,
          emailVerified: resolvedEmailVerified,
          role: roleName,
          twoFactorEnabled: user.twoFactorEnabled,
          platformOperator: isPlatformOperator(user.id, user.email, user.organization.slug),
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          onboardingStep: user.organization.onboardingStep,
          timezone: user.organization.timezone,
        },
        tokens,
      };
    });
  }

  /**
   * Completes login for users with TOTP enabled (second step after password).
   */
  async completeTwoFactorLogin(twoFactorToken: string, code: string) {
    return this.prisma.runWithTransientRetry(async () => {
      let decoded: { sub: string; typ?: string };
      try {
        decoded = await this.jwtService.verifyAsync<{ sub: string; typ?: string }>(twoFactorToken, {
          secret: this.configService.get<string>('app.jwt.secret'),
        });
      } catch {
        throw new UnauthorizedException('Invalid or expired two-factor session');
      }
      const isAdminTotp = decoded.typ === '2fa_pending_admin';
      if (decoded.typ !== '2fa_pending' && !isAdminTotp) {
        throw new UnauthorizedException('Invalid two-factor session');
      }

      const user = await this.prisma.withBypassRls((tx) =>
        tx.user.findUnique({
          where: { id: decoded.sub },
          include: { organization: true, account: true },
        }),
      );

      if (!user) {
        throw new UnauthorizedException('Invalid two-factor session');
      }

      if (user.status === 'suspended') {
        throw new UnauthorizedException(
          'Your account has been suspended. Please contact your organization administrator.',
        );
      }

      if (user.organization.status === 'suspended') {
        throw new UnauthorizedException(
          'Your organization has been suspended. Please contact QlessQ support.',
        );
      }

      if (isAdminTotp) {
        const adminTwoFactor = await this.prisma.withBypassRls((tx) =>
          loadAdminTwoFactorMemberships(tx, user.id),
        );
        if (!adminTwoFactor?.enabled) {
          throw new UnauthorizedException(
            'Admin Dashboard two-factor verification is not required for this account',
          );
        }
      } else if (!user.twoFactorEnabled) {
        throw new UnauthorizedException('Two-factor verification is not required for this account');
      }

      const normalized = code.replace(/\s/g, '');
      let verified: boolean;

      if (isAdminTotp) {
        const adminTwoFactor = await this.prisma.withBypassRls((tx) =>
          loadAdminTwoFactorMemberships(tx, user.id),
        );
        verified = Boolean(adminTwoFactor?.secret && verifyTotp(adminTwoFactor.secret, normalized));
        if (!verified && Array.isArray(adminTwoFactor?.backupHashes)) {
          const hashes = adminTwoFactor.backupHashes as string[];
          for (let i = 0; i < hashes.length; i++) {
            const match = await compareBackupCode(normalized, hashes[i]);
            if (match) {
              verified = true;
              const remaining = hashes.filter((_, j) => j !== i);
              await this.prisma.withBypassRls((tx) =>
                syncAdminTwoFactorToMemberships(tx, adminTwoFactor.memberships, {
                  adminTwoFactorBackupHashes: remaining.length ? remaining : Prisma.DbNull,
                }),
              );
              break;
            }
          }
        }
      } else {
        const u2 = await this.prisma.withBypassRls((tx) =>
          tx.user.findUnique({
            where: { id: user.id },
            select: { twoFactorSecret: true, twoFactorBackupHashes: true },
          }),
        );
        verified = Boolean(u2?.twoFactorSecret && verifyTotp(u2.twoFactorSecret, normalized));

        if (!verified && Array.isArray(u2?.twoFactorBackupHashes)) {
          const hashes = u2.twoFactorBackupHashes as string[];
          for (let i = 0; i < hashes.length; i++) {
            const match = await compareBackupCode(normalized, hashes[i]);
            if (match) {
              verified = true;
              const remaining = hashes.filter((_, j) => j !== i);
              await this.prisma.withBypassRls(
                (tx) =>
                  tx.user.update({
                    where: { id: user.id },
                    data: {
                      twoFactorBackupHashes: remaining.length ? remaining : Prisma.DbNull,
                    },
                  }),
                { orgId: user.orgId },
              );
              break;
            }
          }
        }
      }

      if (!verified) {
        throw new UnauthorizedException('Invalid authenticator code');
      }

      await this.prisma.withBypassRls(
        (tx) =>
          tx.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }),
        { orgId: user.orgId },
      );

      // Lazy sync system roles for the organization (diff-aware)
      this.syncOrgRoles(user.orgId);

      const roleAssignment = await this.prisma.withBypassRls((tx) =>
        tx.roleAssignment.findFirst({
          where: { userId: user.id },
          include: { role: { select: { name: true } } },
        }),
      );

      const tokens = await this.authTokenService.generateTokenPair(
        user.id,
        user.orgId,
        user.organization.slug,
        user.email,
      );
      const resolvedEmailVerified = (user.account?.emailVerified ?? false) || user.emailVerified;

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          orgId: user.orgId,
          emailVerified: resolvedEmailVerified,
          role: roleAssignment?.role?.name ?? 'viewer',
          twoFactorEnabled: user.twoFactorEnabled,
          platformOperator: isPlatformOperator(user.id, user.email, user.organization.slug),
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          onboardingStep: user.organization.onboardingStep,
          timezone: user.organization.timezone,
        },
        tokens,
      };
    });
  }

  syncOrgRoles(orgId: string): void {
    // Upsert permission rows so new resources (e.g. station_profile) are linked on login.
    this.prisma
      .withTenant(orgId, (tx) => syncSystemRolePermissions(tx, orgId, false))
      .catch((err) => {
        this.logger.error(`Failed to lazy-sync roles for org ${orgId}: ${err.message}`);
      });
  }
}
