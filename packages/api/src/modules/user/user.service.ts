import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { SYSTEM_ROLES, passwordSchema } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RedisService } from '../../redis/redis.service';
import { authUserCacheKey } from '../auth/auth-user-cache.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import {
  assertActorMayAssignRoleId,
  assertActorMayManageTargetUser,
} from '../../common/rbac/role-assignment-authorization';
import * as bcrypt from 'bcrypt';

/**
 * Manages organization members (staff) including agents, managers, and admins.
 * Handles user creation, password management, invitations, and role assignment.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  /** Drop the cached auth user so status/role changes take effect immediately. */
  private async invalidateAuthUserCache(userId: string): Promise<void> {
    await this.redis.del(authUserCacheKey(userId)).catch(() => undefined);
  }

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  private async validateBranchIds(orgId: string, branchIds: string[]): Promise<string[]> {
    const uniqueBranchIds = [...new Set(branchIds.map((id) => String(id).trim()).filter(Boolean))];
    if (uniqueBranchIds.length === 0) {
      return [];
    }
    const rows = await this.withOrg(orgId, (tx) =>
      tx.branch.findMany({
        where: { orgId, id: { in: uniqueBranchIds } },
        select: { id: true },
      }),
    );
    if (rows.length !== uniqueBranchIds.length) {
      throw new BadRequestException('One or more selected branches are invalid');
    }
    return uniqueBranchIds;
  }

  /** When the org has any branch, branch-scoped roles must have at least one branch. Owner/Admin are org-wide. */
  private roleRequiresAssignedBranches(roleName: string): boolean {
    const n = String(roleName ?? '').toLowerCase();
    return n === SYSTEM_ROLES.MANAGER || n === SYSTEM_ROLES.STAFF || n === SYSTEM_ROLES.VIEWER;
  }

  private async assertAssignedBranchesIfNeeded(
    orgId: string,
    roleName: string,
    normalizedBranchIds: string[],
  ): Promise<void> {
    const orgBranchCount = await this.withOrg(orgId, (tx) => tx.branch.count({ where: { orgId } }));
    if (orgBranchCount === 0) {
      return;
    }
    if (this.roleRequiresAssignedBranches(roleName) && normalizedBranchIds.length === 0) {
      throw new BadRequestException(
        'Select at least one branch. This organization has branch locations, so assigned branches are required for this role.',
      );
    }
  }

  async list(
    orgId: string,
    filters: {
      branchId?: string;
      roleId?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      const s = filters.search.trim();
      const parts = s.split(/\s+/);

      if (parts.length > 1) {
        const firstPart = parts[0]!;
        const lastPart = parts[parts.length - 1]!;

        where.OR = [
          {
            AND: [
              { firstName: { contains: firstPart, mode: 'insensitive' } },
              { lastName: { contains: lastPart, mode: 'insensitive' } },
            ],
          },
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ];
      } else {
        where.OR = [
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const [data, total] = await this.withOrg(orgId, (tx) =>
      Promise.all([
        tx.user.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            avatarUrl: true,
            language: true,
            createdAt: true,
            roleAssignments: {
              include: {
                role: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.user.count({ where }),
      ]),
    );

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listForPrincipal(
    orgId: string,
    actorUserId: string,
    filters: { status?: string; search?: string; page?: number; limit?: number },
  ) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, actorUserId);
    if (allowed === null) {
      return this.list(orgId, filters);
    }
    if (allowed.length === 0) {
      return { data: [], meta: { page: 1, limit: filters.limit ?? 20, total: 0, totalPages: 0 } };
    }
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const where: any = {
      orgId,
      roleAssignments: { some: { branchId: { in: allowed } } },
    };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      const s = filters.search.trim();
      const parts = s.split(/\s+/);

      if (parts.length > 1) {
        const firstPart = parts[0]!;
        const lastPart = parts[parts.length - 1]!;

        where.OR = [
          {
            AND: [
              { firstName: { contains: firstPart, mode: 'insensitive' } },
              { lastName: { contains: lastPart, mode: 'insensitive' } },
            ],
          },
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ];
      } else {
        where.OR = [
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ];
      }
    }
    const [data, total] = await this.withOrg(orgId, (tx) =>
      Promise.all([
        tx.user.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            avatarUrl: true,
            language: true,
            createdAt: true,
            roleAssignments: {
              include: {
                role: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        tx.user.count({ where }),
      ]),
    );
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(orgId: string, userId: string) {
    const user = await this.withOrg(orgId, (tx) =>
      tx.user.findFirst({
        where: { id: userId, orgId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          avatarUrl: true,
          language: true,
          timezone: true,
          createdAt: true,
          updatedAt: true,
          roleAssignments: {
            include: {
              role: { include: { rolePermissions: { include: { permission: true } } } },
              branch: { select: { id: true, name: true } },
            },
          },
        },
      }),
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async invite(
    orgId: string,
    actorUserId: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      roleId: string;
      password: string;
      branchIds?: string[];
    },
  ) {
    await assertActorMayAssignRoleId(this.prisma, orgId, actorUserId, data.roleId);

    const existing = await this.withOrg(orgId, (tx) =>
      tx.user.findFirst({ where: { email: data.email, orgId } }),
    );
    if (existing)
      throw new ConflictException('User with this email already exists in this organization');

    try {
      passwordSchema.parse(data.password);
    } catch (err) {
      if (err instanceof Error) {
        throw new BadRequestException(err.message);
      }
      throw new BadRequestException('Invalid password format');
    }
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const emailNorm = data.email.toLowerCase();

    const role = await this.withOrg(orgId, (tx) =>
      tx.role.findFirst({
        where: { id: data.roleId, orgId },
        select: { id: true, name: true },
      }),
    );
    if (!role) {
      throw new BadRequestException('Role not found in this organization');
    }
    const requestedBranchIds = await this.validateBranchIds(orgId, data.branchIds ?? []);
    await this.assertAssignedBranchesIfNeeded(orgId, role.name, requestedBranchIds);

    const user = await this.withOrg(orgId, async (tx) => {
      const existingAccount = await tx.account.findUnique({ where: { email: emailNorm } });
      let newUser;

      if (existingAccount) {
        // IMPORTANT: If account exists, we ignore the password provided by the admin.
        // We do NOT check bcrypt.compare here because the admin shouldn't know
        // the user's existing password, and we shouldn't block the invite.
        newUser = await tx.user.create({
          data: {
            accountId: existingAccount.id,
            orgId,
            email: emailNorm,
            firstName: data.firstName,
            lastName: data.lastName,
            // We store the existing hash on the user record for legacy fallback,
            // though the primary auth will now happen via the Account table.
            passwordHash: existingAccount.passwordHash,
            status: 'active',
            emailVerified: true,
          },
        });
      } else {
        const acc = await tx.account.create({
          data: {
            email: emailNorm,
            passwordHash: hashedPassword,
            emailVerified: true,
            phone: null,
          },
        });
        newUser = await tx.user.create({
          data: {
            accountId: acc.id,
            orgId,
            email: emailNorm,
            firstName: data.firstName,
            lastName: data.lastName,
            passwordHash: hashedPassword,
            status: 'active',
            emailVerified: true,
          },
        });
      }

      if (role.name === SYSTEM_ROLES.OWNER || role.name === SYSTEM_ROLES.ADMIN) {
        await tx.roleAssignment.create({
          data: {
            userId: newUser.id,
            roleId: role.id,
            branchId: null,
          },
        });
      } else if (requestedBranchIds.length > 0) {
        await tx.roleAssignment.createMany({
          data: requestedBranchIds.map((branchId) => ({
            userId: newUser.id,
            roleId: role.id,
            branchId,
          })),
        });
      } else {
        await tx.roleAssignment.create({
          data: {
            userId: newUser.id,
            roleId: role.id,
            branchId: null,
          },
        });
      }

      return newUser;
    });

    return { id: user.id, email: user.email, status: user.status };
  }

  /**
   * Updates profile fields on `User`. `roleId` is not a User column — it updates the user's
   * first `RoleAssignment` (same convention as the dashboard users UI) or creates an org-wide
   * assignment when none exists.
   */
  async update(
    orgId: string,
    userId: string,
    actorUserId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      description: string;
      language: string;
      timezone: string;
      avatarUrl: string;
      roleId: string;
      branchIds: string[];
    }>,
  ) {
    await this.getById(orgId, userId);

    const raw = data as Record<string, unknown>;
    if (raw.password !== undefined || raw.passwordHash !== undefined) {
      throw new BadRequestException(
        'Passwords cannot be changed through the user profile API. Use the forgot-password link on the login page to reset access, or ask an administrator to invite a new account.',
      );
    }

    const { roleId, branchIds, ...rest } = data;
    const allowedScalarKeys = new Set([
      'firstName',
      'lastName',
      'phone',
      'description',
      'language',
      'timezone',
      'avatarUrl',
    ]);
    const scalarData = Object.fromEntries(
      Object.entries(rest).filter(([k, v]) => allowedScalarKeys.has(k) && v !== undefined),
    ) as Record<string, string>;

    const wantsRoleChange = roleId !== undefined && String(roleId).trim() !== '';
    const wantsBranchReassignment = Array.isArray(branchIds);
    const hasScalarUpdates = Object.keys(scalarData).length > 0;

    if (actorUserId === userId && hasScalarUpdates) {
      throw new ForbiddenException('Assigned users cannot modify their own core profile fields');
    }

    if (wantsRoleChange || wantsBranchReassignment || hasScalarUpdates) {
      await assertActorMayManageTargetUser(this.prisma, orgId, actorUserId, userId);
    }

    if (!hasScalarUpdates && !wantsRoleChange && !wantsBranchReassignment) {
      return this.withOrg(orgId, (tx) =>
        tx.user.findFirstOrThrow({
          where: { id: userId, orgId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            avatarUrl: true,
          },
        }),
      );
    }

    return this.withOrg(orgId, async (tx) => {
      if (hasScalarUpdates) {
        await tx.user.update({
          where: { id: userId },
          data: scalarData,
        });
      }

      if (wantsRoleChange) {
        const nextRoleId = String(roleId).trim();
        const role = await tx.role.findFirst({ where: { id: nextRoleId, orgId } });
        if (!role) {
          throw new BadRequestException('Role not found in this organization');
        }

        await assertActorMayAssignRoleId(this.prisma, orgId, actorUserId, nextRoleId);

        const primary = await tx.roleAssignment.findFirst({
          where: { userId },
          orderBy: { id: 'asc' },
        });

        const isNewRoleGlobal =
          role.name === SYSTEM_ROLES.OWNER || role.name === SYSTEM_ROLES.ADMIN;

        if (!primary) {
          await tx.roleAssignment.create({
            data: { userId, roleId: nextRoleId, branchId: null },
          });
        } else {
          await tx.roleAssignment.update({
            where: { id: primary.id },
            data: {
              roleId: nextRoleId,
              // If promoting to a global role, we must clear the branchId
              ...(isNewRoleGlobal ? { branchId: null } : {}),
            },
          });

          // If they are becoming an owner/admin, they shouldn't have multiple branch assignments
          if (isNewRoleGlobal) {
            await tx.roleAssignment.deleteMany({
              where: {
                userId,
                id: { not: primary.id },
              },
            });
          }
        }
      }

      if (wantsBranchReassignment) {
        const normalizedBranchIds = await this.validateBranchIds(orgId, branchIds ?? []);
        const currentAssignments = await tx.roleAssignment.findMany({
          where: { userId, role: { orgId } },
          include: { role: { select: { name: true } } },
          orderBy: { id: 'asc' },
        });

        if (currentAssignments.length > 0) {
          const currentRoleId = currentAssignments[0].roleId;
          const currentRoleName = currentAssignments[0].role.name;
          await this.assertAssignedBranchesIfNeeded(orgId, currentRoleName, normalizedBranchIds);

          await tx.roleAssignment.deleteMany({
            where: { userId, role: { orgId } },
          });

          if (currentRoleName === SYSTEM_ROLES.OWNER || currentRoleName === SYSTEM_ROLES.ADMIN) {
            await tx.roleAssignment.create({
              data: { userId, roleId: currentRoleId, branchId: null },
            });
          } else if (normalizedBranchIds.length > 0) {
            await tx.roleAssignment.createMany({
              data: normalizedBranchIds.map((branchId) => ({
                userId,
                roleId: currentRoleId,
                branchId,
              })),
            });
          } else {
            await tx.roleAssignment.create({
              data: { userId, roleId: currentRoleId, branchId: null },
            });
          }
        }
      }

      return tx.user.findFirstOrThrow({
        where: { id: userId, orgId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          avatarUrl: true,
        },
      });
    });
  }

  /**
   * Clears two-factor authentication for another org member (recovery when authenticator and backup codes are lost).
   * Revokes all active sessions for the target user. Cannot be used on your own account.
   */
  async resetTwoFactorForUser(orgId: string, targetUserId: string, actorUserId: string) {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException(
        'You cannot reset two-factor authentication for your own account from here. Use your authenticator and backup codes in Settings, ask another administrator, or use the email password reset flow if you are the organization owner.',
      );
    }

    await this.getById(orgId, targetUserId);

    await assertActorMayManageTargetUser(this.prisma, orgId, actorUserId, targetUserId);

    const target = await this.withOrg(orgId, (tx) =>
      tx.user.findFirst({
        where: { id: targetUserId, orgId },
        select: {
          id: true,
          email: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          adminTwoFactorEnabled: true,
          adminTwoFactorSecret: true,
        },
      }),
    );
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const had2fa =
      target.twoFactorEnabled === true ||
      Boolean(target.twoFactorSecret) ||
      target.adminTwoFactorEnabled === true ||
      Boolean(target.adminTwoFactorSecret);

    await this.withOrg(orgId, async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupHashes: Prisma.DbNull,
          adminTwoFactorEnabled: false,
          adminTwoFactorSecret: null,
          adminTwoFactorBackupHashes: Prisma.DbNull,
        },
      });
      await tx.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'user.two_factor_reset',
      resourceType: 'user',
      resourceId: targetUserId,
      metadata: {
        targetEmail: target.email,
        twoFactorWasEnabled: had2fa,
      } as Prisma.InputJsonObject,
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'two_factor_reset',
      tableName: 'users',
      recordId: targetUserId,
      oldValues: {
        twoFactorEnabled: target.twoFactorEnabled,
        hadPendingSecret: Boolean(target.twoFactorSecret),
        adminTwoFactorEnabled: target.adminTwoFactorEnabled,
      },
      newValues: {
        twoFactorEnabled: false,
        twoFactorSecretCleared: true,
        twoFactorBackupHashesCleared: true,
        adminTwoFactorEnabled: false,
        adminTwoFactorSecretCleared: true,
        adminTwoFactorBackupHashesCleared: true,
      } as Prisma.InputJsonObject,
    });

    return { reset: true, twoFactorWasEnabled: had2fa };
  }

  /**
   * Owner or admin sets a new password for another org member (recovery when email reset is unavailable).
   * Clears two-factor enrollment and revokes all sessions so the user signs in with the new password only,
   * then completes mandatory 2FA setup again on the dashboard.
   */
  async setPasswordForUser(
    orgId: string,
    targetUserId: string,
    actorUserId: string,
    newPassword: string,
  ) {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException(
        'You cannot set your own password here. Use account settings or the email password reset flow where applicable.',
      );
    }

    await this.getById(orgId, targetUserId);

    await assertActorMayManageTargetUser(this.prisma, orgId, actorUserId, targetUserId);

    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof Error) {
        throw new BadRequestException(err.message);
      }
      throw new BadRequestException('Invalid password format');
    }

    const account = await this.withOrg(orgId, (tx) =>
      tx.user.findFirst({
        where: { id: targetUserId, orgId },
        select: { id: true, email: true, twoFactorEnabled: true, adminTwoFactorEnabled: true },
      }),
    );
    if (!account) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const had2fa = account.twoFactorEnabled === true || account.adminTwoFactorEnabled === true;

    await this.withOrg(orgId, async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          passwordHash,
          status: 'active',
          emailVerified: true,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupHashes: Prisma.DbNull,
          adminTwoFactorEnabled: false,
          adminTwoFactorSecret: null,
          adminTwoFactorBackupHashes: Prisma.DbNull,
        },
      });
      await tx.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.audit.logActivity({
      orgId,
      userId: actorUserId,
      action: 'user.password_set_by_admin',
      resourceType: 'user',
      resourceId: targetUserId,
      metadata: {
        targetEmail: account.email,
        twoFactorWasCleared: had2fa,
      } as Prisma.InputJsonObject,
    });
    await this.audit.logAudit({
      orgId,
      userId: actorUserId,
      action: 'password_set_by_admin',
      tableName: 'users',
      recordId: targetUserId,
      oldValues: {
        twoFactorEnabled: account.twoFactorEnabled,
        adminTwoFactorEnabled: account.adminTwoFactorEnabled,
      } as Prisma.InputJsonObject,
      newValues: {
        passwordRotated: true,
        twoFactorEnabled: false,
        twoFactorSecretCleared: true,
        twoFactorBackupHashesCleared: true,
        adminTwoFactorEnabled: false,
        adminTwoFactorSecretCleared: true,
        adminTwoFactorBackupHashesCleared: true,
      } as Prisma.InputJsonObject,
    });

    return { success: true as const, twoFactorCleared: had2fa };
  }

  async deactivate(orgId: string, userId: string, actorUserId: string) {
    await this.getById(orgId, userId);
    await assertActorMayManageTargetUser(this.prisma, orgId, actorUserId, userId);
    const updated = await this.withOrg(orgId, (tx) =>
      tx.user.update({ where: { id: userId }, data: { status: 'inactive' } }),
    );
    await this.invalidateAuthUserCache(userId);
    return updated;
  }

  async activate(orgId: string, userId: string, actorUserId: string) {
    await this.getById(orgId, userId);
    await assertActorMayManageTargetUser(this.prisma, orgId, actorUserId, userId);
    const updated = await this.withOrg(orgId, (tx) =>
      tx.user.update({ where: { id: userId }, data: { status: 'active' } }),
    );
    await this.invalidateAuthUserCache(userId);
    return updated;
  }

  async delete(orgId: string, userId: string, actorUserId: string) {
    await this.getById(orgId, userId);
    await assertActorMayManageTargetUser(this.prisma, orgId, actorUserId, userId);
    await this.withOrg(orgId, async (tx) => {
      await tx.roleAssignment.deleteMany({ where: { userId, role: { orgId } } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    await this.invalidateAuthUserCache(userId);
  }
}
