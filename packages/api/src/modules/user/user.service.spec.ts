import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { SYSTEM_ROLES } from '@queueplatform/shared';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$abcdefghijklmnopqrstuu1234567890abcdefghijklmnopqrstuv'),
}));

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  role: { findFirst: vi.fn() },
  roleAssignment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  account: { findUnique: vi.fn(), create: vi.fn() },
  session: { updateMany: vi.fn() },
  branch: { findMany: vi.fn(), count: vi.fn() },
};

const defaultAccountCreate = {
  id: 'acc-test',
  passwordHash: '$2b$12$abcdefghijklmnopqrstuu1234567890abcdefghijklmnopqrstuv',
};

const mockAudit = {
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
};

const mockRedis = {
  del: vi.fn().mockResolvedValue(undefined),
  getJson: vi.fn().mockResolvedValue(null),
  setJson: vi.fn().mockResolvedValue(undefined),
};

describe('UserService', () => {
  let service: UserService;

  const ownerActorIds = new Set(['actor-1', 'owner-a', 'owner-1']);
  const adminActorIds = new Set(['admin-1']);

  function mockRoleAssignmentsByUser() {
    mockPrisma.roleAssignment.findMany.mockImplementation(
      async (args: { where: { userId: string } }) => {
        if (ownerActorIds.has(args.where.userId)) {
          return [{ role: { name: SYSTEM_ROLES.OWNER } }];
        }
        if (adminActorIds.has(args.where.userId)) {
          return [{ role: { name: SYSTEM_ROLES.ADMIN } }];
        }
        if (
          args.where.userId === 'owner-user' ||
          args.where.userId === 'owner-b' ||
          args.where.userId === 'owner-target'
        ) {
          return [{ role: { name: SYSTEM_ROLES.OWNER } }];
        }
        if (args.where.userId === 'admin-user') {
          return [{ role: { name: SYSTEM_ROLES.ADMIN } }];
        }
        if (args.where.userId === 'u1' || args.where.userId === 'staff-1') {
          return [{ role: { name: SYSTEM_ROLES.STAFF } }];
        }
        return [];
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    mockPrisma.branch.count.mockResolvedValue(0);
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.account.create.mockResolvedValue(defaultAccountCreate);
    mockPrisma.roleAssignment.create.mockResolvedValue({});
    mockPrisma.roleAssignment.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.roleAssignment.deleteMany.mockResolvedValue({ count: 0 });
    mockRoleAssignmentsByUser();
    service = new UserService(mockPrisma as never, mockAudit as never, mockRedis as never);
  });

  describe('invite', () => {
    it('rejects passwords shorter than 8 characters', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ name: SYSTEM_ROLES.STAFF });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.invite('org-1', 'actor-1', {
          email: 'a@b.com',
          firstName: 'A',
          lastName: 'B',
          roleId: 'role-staff',
          password: 'short',
          branchIds: ['branch-1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires at least one branch for manager role when the org has branches', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-mgr', name: SYSTEM_ROLES.MANAGER });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.branch.count.mockResolvedValue(1);

      await expect(
        service.invite('org-1', 'actor-1', {
          email: 'mgr@b.com',
          firstName: 'M',
          lastName: 'R',
          roleId: 'role-mgr',
          password: 'ValidPass1a',
          branchIds: [],
        }),
      ).rejects.toThrow(/Select at least one branch/);
    });

    it('forbids manager from inviting a user with admin role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-admin', name: SYSTEM_ROLES.ADMIN });
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        { role: { name: SYSTEM_ROLES.MANAGER } },
      ]);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.invite('org-1', 'mgr-1', {
          email: 'new@b.com',
          firstName: 'N',
          lastName: 'U',
          roleId: 'role-admin',
          password: 'ValidPass1a',
          branchIds: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when email already exists in org', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ name: SYSTEM_ROLES.STAFF });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.invite('org-1', 'actor-1', {
          email: 'dup@b.com',
          firstName: 'A',
          lastName: 'B',
          roleId: 'role-staff',
          password: 'ValidPass1a',
          branchIds: ['branch-1'],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates branch-scoped role assignments for staff when branchIds provided', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-staff', name: SYSTEM_ROLES.STAFF });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'branch-1' }]);

      const txUserCreate = vi.fn().mockResolvedValue({
        id: 'new-user-1',
        email: 'staff@b.com',
        status: 'active',
      });
      const txRoleCreateMany = vi.fn().mockResolvedValue({ count: 1 });
      mockPrisma.user.create.mockImplementation(txUserCreate);
      mockPrisma.roleAssignment.createMany.mockImplementation(txRoleCreateMany);

      const result = await service.invite('org-1', 'actor-1', {
        email: 'staff@b.com',
        firstName: 'S',
        lastName: 'T',
        roleId: 'role-staff',
        password: 'ValidPass1a',
        branchIds: ['branch-1'],
      });

      expect(result).toEqual({ id: 'new-user-1', email: 'staff@b.com', status: 'active' });
      expect(txUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'acc-test',
            email: 'staff@b.com',
            status: 'active',
            emailVerified: true,
            passwordHash: expect.stringMatching(/^\$2[aby]\$/),
          }),
        }),
      );
      expect(txRoleCreateMany).toHaveBeenCalledWith({
        data: [{ userId: 'new-user-1', roleId: 'role-staff', branchId: 'branch-1' }],
      });
    });

    it('creates org-wide assignment for admin when the org has no branches (branchIds may be empty)', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-admin', name: SYSTEM_ROLES.ADMIN });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.branch.count.mockResolvedValue(0);

      const txUserCreate = vi.fn().mockResolvedValue({
        id: 'admin-user',
        email: 'admin@b.com',
        status: 'active',
      });
      const txRoleCreate = vi.fn().mockResolvedValue({});
      const txRoleCreateMany = vi.fn().mockResolvedValue({ count: 0 });
      mockPrisma.user.create.mockImplementation(txUserCreate);
      mockPrisma.roleAssignment.create.mockImplementation(txRoleCreate);
      mockPrisma.roleAssignment.createMany.mockImplementation(txRoleCreateMany);

      await service.invite('org-1', 'actor-1', {
        email: 'admin@b.com',
        firstName: 'A',
        lastName: 'D',
        roleId: 'role-admin',
        password: 'ValidPass1a',
        branchIds: [],
      });

      expect(txRoleCreate).toHaveBeenCalledWith({
        data: { userId: 'admin-user', roleId: 'role-admin', branchId: null },
      });
      expect(txRoleCreateMany).not.toHaveBeenCalled();
    });

    it('creates only org-wide assignment for admin when the org has branches and branchIds are empty', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-admin', name: SYSTEM_ROLES.ADMIN });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.branch.count.mockResolvedValue(2);

      const txUserCreate = vi.fn().mockResolvedValue({
        id: 'admin-user',
        email: 'admin2@b.com',
        status: 'active',
      });
      const txRoleCreate = vi.fn().mockResolvedValue({});
      const txRoleCreateMany = vi.fn().mockResolvedValue({ count: 0 });
      mockPrisma.user.create.mockImplementation(txUserCreate);
      mockPrisma.roleAssignment.create.mockImplementation(txRoleCreate);
      mockPrisma.roleAssignment.createMany.mockImplementation(txRoleCreateMany);

      await service.invite('org-1', 'actor-1', {
        email: 'admin2@b.com',
        firstName: 'A',
        lastName: 'D',
        roleId: 'role-admin',
        password: 'ValidPass1a',
        branchIds: [],
      });

      expect(txRoleCreate).toHaveBeenCalledWith({
        data: { userId: 'admin-user', roleId: 'role-admin', branchId: null },
      });
      expect(txRoleCreateMany).not.toHaveBeenCalled();
    });

    it('ignores branchIds for admin invite; only org-wide assignment is created', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-admin', name: SYSTEM_ROLES.ADMIN });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.branch.count.mockResolvedValue(1);
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'branch-1' }]);

      const txUserCreate = vi.fn().mockResolvedValue({
        id: 'admin-user',
        email: 'admin@b.com',
        status: 'active',
      });
      const txRoleCreate = vi.fn().mockResolvedValue({});
      const txRoleCreateMany = vi.fn().mockResolvedValue({ count: 0 });
      mockPrisma.user.create.mockImplementation(txUserCreate);
      mockPrisma.roleAssignment.create.mockImplementation(txRoleCreate);
      mockPrisma.roleAssignment.createMany.mockImplementation(txRoleCreateMany);

      await service.invite('org-1', 'actor-1', {
        email: 'admin@b.com',
        firstName: 'A',
        lastName: 'D',
        roleId: 'role-admin',
        password: 'ValidPass1a',
        branchIds: ['branch-1'],
      });

      expect(txRoleCreate).toHaveBeenCalledWith({
        data: { userId: 'admin-user', roleId: 'role-admin', branchId: null },
      });
      expect(txRoleCreateMany).not.toHaveBeenCalled();
    });

    it('forbids non-owner from assigning owner role', async () => {
      mockPrisma.role.findFirst.mockImplementation(
        async (args: { where: { id?: string; name?: string; isSystemRole?: boolean } }) => {
          if (args.where.id === 'role-owner') {
            return { name: SYSTEM_ROLES.OWNER };
          }
          return null;
        },
      );
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.invite('org-1', 'admin-1', {
          email: 'owner@b.com',
          firstName: 'O',
          lastName: 'W',
          roleId: 'role-owner',
          password: 'ValidPass1a',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('forbids users from changing their own scalar profile fields', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        orgId: 'org-1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        roleAssignments: [],
      });

      await expect(service.update('org-1', 'u1', 'u1', { firstName: 'Changed' })).rejects.toThrow(
        /cannot modify their own core profile fields/,
      );
    });

    it('rejects password fields on profile update', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        orgId: 'org-1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        roleAssignments: [],
      });

      await expect(
        service.update('org-1', 'u1', 'admin-1', { password: 'newpassword1' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('reassigns branches when branchIds is provided', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        orgId: 'org-1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        roleAssignments: [],
      });
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);

      mockPrisma.roleAssignment.findMany.mockImplementation(
        async (args: { where: { userId: string } }) => {
          if (args.where.userId === 'admin-1') {
            return [{ role: { name: SYSTEM_ROLES.ADMIN } }];
          }
          if (args.where.userId === 'u1') {
            return [{ id: 'ra-1', roleId: 'role-staff', role: { name: SYSTEM_ROLES.STAFF } }];
          }
          return [];
        },
      );
      const txRoleDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
      const txRoleCreateMany = vi.fn().mockResolvedValue({ count: 2 });
      const txUserFindFirstOrThrow = vi.fn().mockResolvedValue({
        id: 'u1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        phone: null,
        status: 'active',
        avatarUrl: null,
      });

      mockPrisma.roleAssignment.deleteMany.mockImplementation(txRoleDeleteMany);
      mockPrisma.roleAssignment.createMany.mockImplementation(txRoleCreateMany);
      mockPrisma.user.findFirstOrThrow.mockImplementation(txUserFindFirstOrThrow);
      mockPrisma.branch.count.mockResolvedValue(1);

      await service.update('org-1', 'u1', 'admin-1', { branchIds: ['b1', 'b2'] });

      expect(txRoleDeleteMany).toHaveBeenCalled();
      expect(txRoleCreateMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', roleId: 'role-staff', branchId: 'b1' },
          { userId: 'u1', roleId: 'role-staff', branchId: 'b2' },
        ],
      });
    });

    it('allows branch reassignment for admin with empty branchIds: single org-wide row', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        orgId: 'org-1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        roleAssignments: [],
      });
      mockPrisma.branch.count.mockResolvedValue(1);

      mockPrisma.roleAssignment.findMany.mockImplementation(
        async (args: { where: { userId: string } }) => {
          if (args.where.userId === 'actor-1') {
            return [{ role: { name: SYSTEM_ROLES.OWNER } }];
          }
          if (args.where.userId === 'u1') {
            return [{ id: 'ra-1', roleId: 'role-admin', role: { name: SYSTEM_ROLES.ADMIN } }];
          }
          return [];
        },
      );
      const txRoleDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
      const txRoleCreate = vi.fn().mockResolvedValue({});
      const txRoleCreateMany = vi.fn();
      mockPrisma.roleAssignment.deleteMany.mockImplementation(txRoleDeleteMany);
      mockPrisma.roleAssignment.create.mockImplementation(txRoleCreate);
      mockPrisma.roleAssignment.createMany.mockImplementation(txRoleCreateMany);
      mockPrisma.user.findFirstOrThrow.mockResolvedValue({
        id: 'u1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        phone: null,
        status: 'active',
        avatarUrl: null,
      });

      await service.update('org-1', 'u1', 'actor-1', { branchIds: [] });

      expect(txRoleDeleteMany).toHaveBeenCalled();
      expect(txRoleCreate).toHaveBeenCalledWith({
        data: { userId: 'u1', roleId: 'role-admin', branchId: null },
      });
      expect(txRoleCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('deactivate / activate', () => {
    it('forbids non-owner from deactivating a user with owner role assignment', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'owner-user',
        orgId: 'org-1',
        firstName: 'O',
        lastName: 'W',
        email: 'owner@b.com',
        roleAssignments: [],
      });
      mockPrisma.roleAssignment.findMany.mockImplementation(
        async (args: { where: { userId: string } }) => {
          if (args.where.userId === 'admin-1') return [{ role: { name: SYSTEM_ROLES.ADMIN } }];
          if (args.where.userId === 'owner-user') return [{ role: { name: SYSTEM_ROLES.OWNER } }];
          return [];
        },
      );

      await expect(service.deactivate('org-1', 'owner-user', 'admin-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('allows org owner to deactivate another user who has owner assignment', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'owner-b',
        orgId: 'org-1',
        firstName: 'B',
        lastName: 'O',
        email: 'b@b.com',
        roleAssignments: [],
      });
      mockPrisma.roleAssignment.findMany.mockImplementation(
        async (args: { where: { userId: string } }) => {
          if (args.where.userId === 'owner-a' || args.where.userId === 'owner-b') {
            return [{ role: { name: SYSTEM_ROLES.OWNER } }];
          }
          return [];
        },
      );
      mockPrisma.user.update.mockResolvedValue({ id: 'owner-b', status: 'inactive' });

      await service.deactivate('org-1', 'owner-b', 'owner-a');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'owner-b' },
        data: { status: 'inactive' },
      });
    });

    it('forbids non-owner from activating a user with owner role assignment', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'owner-user',
        orgId: 'org-1',
        firstName: 'O',
        lastName: 'W',
        email: 'owner@b.com',
        roleAssignments: [],
      });
      mockPrisma.roleAssignment.findMany.mockImplementation(
        async (args: { where: { userId: string } }) => {
          if (args.where.userId === 'admin-1') return [{ role: { name: SYSTEM_ROLES.ADMIN } }];
          if (args.where.userId === 'owner-user') return [{ role: { name: SYSTEM_ROLES.OWNER } }];
          return [];
        },
      );

      await expect(service.activate('org-1', 'owner-user', 'admin-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('forbids manager from deactivating an admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'admin-user',
        orgId: 'org-1',
        firstName: 'A',
        lastName: 'D',
        email: 'admin@b.com',
        roleAssignments: [],
      });
      mockPrisma.roleAssignment.findMany.mockImplementation(
        async (args: { where: { userId: string } }) => {
          if (args.where.userId === 'mgr-1') return [{ role: { name: SYSTEM_ROLES.MANAGER } }];
          if (args.where.userId === 'admin-user') return [{ role: { name: SYSTEM_ROLES.ADMIN } }];
          return [];
        },
      );

      await expect(service.deactivate('org-1', 'admin-user', 'mgr-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('resetTwoFactorForUser', () => {
    const getByIdUser = {
      id: 'staff-1',
      orgId: 'org-1',
      firstName: 'S',
      lastName: 'T',
      email: 'staff@b.com',
      phone: null,
      status: 'active',
      avatarUrl: null,
      language: null,
      timezone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      roleAssignments: [{ role: { id: 'r-staff', name: SYSTEM_ROLES.STAFF }, branch: null }],
    };

    beforeEach(() => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.session.updateMany.mockResolvedValue({ count: 2 });
    });

    it('forbids resetting your own two-factor authentication', async () => {
      await expect(service.resetTwoFactorForUser('org-1', 'u1', 'u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('forbids non-owner from resetting 2FA for an owner account', async () => {
      const ownerGetById = {
        ...getByIdUser,
        id: 'owner-target',
        email: 'owner@b.com',
        roleAssignments: [{ role: { id: 'r-owner', name: SYSTEM_ROLES.OWNER }, branch: null }],
      };
      mockPrisma.user.findFirst.mockResolvedValueOnce(ownerGetById);

      await expect(
        service.resetTwoFactorForUser('org-1', 'owner-target', 'admin-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows org owner to reset 2FA for a staff member and writes audit records', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(getByIdUser).mockResolvedValueOnce({
        id: 'staff-1',
        email: 'staff@b.com',
        twoFactorEnabled: true,
        twoFactorSecret: 'ABCD1234',
      });

      const out = await service.resetTwoFactorForUser('org-1', 'staff-1', 'owner-1');

      expect(out).toEqual({ reset: true, twoFactorWasEnabled: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'staff-1' },
        data: expect.objectContaining({
          twoFactorEnabled: false,
          twoFactorSecret: null,
        }),
      });
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'staff-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockAudit.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-1',
          action: 'user.two_factor_reset',
          resourceId: 'staff-1',
        }),
      );
      expect(mockAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'two_factor_reset',
          tableName: 'users',
          recordId: 'staff-1',
        }),
      );
    });
  });

  describe('setPasswordForUser', () => {
    const staffGetById = {
      id: 'staff-1',
      orgId: 'org-1',
      firstName: 'S',
      lastName: 'T',
      email: 'staff@b.com',
      phone: null,
      status: 'active',
      avatarUrl: null,
      language: null,
      timezone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      roleAssignments: [{ role: { id: 'r-staff', name: SYSTEM_ROLES.STAFF }, branch: null }],
    };

    beforeEach(() => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.session.updateMany.mockResolvedValue({ count: 2 });
    });

    it('forbids setting your own password via this endpoint', async () => {
      await expect(service.setPasswordForUser('org-1', 'u1', 'u1', 'ValidPass1a')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('forbids non-owner from setting password for an owner account', async () => {
      const ownerGetById = {
        ...staffGetById,
        id: 'owner-target',
        email: 'owner@b.com',
        roleAssignments: [{ role: { id: 'r-owner', name: SYSTEM_ROLES.OWNER }, branch: null }],
      };
      mockPrisma.user.findFirst.mockResolvedValueOnce(ownerGetById);

      await expect(
        service.setPasswordForUser('org-1', 'owner-target', 'admin-1', 'ValidPass1a'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects passwords that fail policy', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(staffGetById);

      await expect(
        service.setPasswordForUser('org-1', 'staff-1', 'owner-1', 'short'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows org owner to set password for staff, clears 2FA, revokes sessions, and audits', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(staffGetById).mockResolvedValueOnce({
        id: 'staff-1',
        email: 'staff@b.com',
        twoFactorEnabled: true,
      });

      const out = await service.setPasswordForUser('org-1', 'staff-1', 'owner-1', 'ValidPass1a');

      expect(out).toEqual({ success: true, twoFactorCleared: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'staff-1' },
        data: expect.objectContaining({
          passwordHash: expect.stringMatching(/^\$2[aby]\$/),
          twoFactorEnabled: false,
          twoFactorSecret: null,
          emailVerified: true,
          status: 'active',
        }),
      });
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'staff-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockAudit.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-1',
          action: 'user.password_set_by_admin',
          resourceId: 'staff-1',
        }),
      );
      expect(mockAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'password_set_by_admin',
          tableName: 'users',
          recordId: 'staff-1',
        }),
      );
    });
  });
});
