import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RoleService } from './role.service';
import { SYSTEM_ROLES } from '@queueplatform/shared';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  role: {
    findFirst: vi.fn(),
  },
  roleAssignment: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
};

const mockAudit = {
  logActivity: vi.fn().mockResolvedValue(undefined),
};

// Mock the authorization guards used inside the service to let us focus on RoleService logic
vi.mock('../../common/rbac/role-assignment-authorization', () => ({
  assertActorMayAssignRoleId: vi.fn().mockResolvedValue(undefined),
  assertActorMayManageTargetUser: vi.fn().mockResolvedValue(undefined),
}));

describe('RoleService', () => {
  let service: RoleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RoleService(mockPrisma as never, mockAudit as never);
  });

  describe('assignToUser', () => {
    it('successfully assigns an organization-scoped role (Owner) when branchId is omitted', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-owner-id',
        name: SYSTEM_ROLES.OWNER,
        isSystemRole: true,
      });
      mockPrisma.roleAssignment.findFirst.mockResolvedValue(null);
      mockPrisma.roleAssignment.create.mockResolvedValue({
        id: 'new-assignment-id',
        role: { id: 'role-owner-id', name: SYSTEM_ROLES.OWNER },
        user: { id: 'target-user-id', firstName: 'John', lastName: 'Doe' },
        branch: null,
      });

      const result = await service.assignToUser('org-1', 'actor-id', {
        userId: 'target-user-id',
        roleId: 'role-owner-id',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.roleAssignment.create).toHaveBeenCalledWith({
        data: { userId: 'target-user-id', roleId: 'role-owner-id', branchId: undefined },
        include: expect.any(Object),
      });
    });

    it('throws BadRequestException when assigning organization-scoped role (Owner) with a branchId', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-owner-id',
        name: SYSTEM_ROLES.OWNER,
        isSystemRole: true,
      });

      await expect(
        service.assignToUser('org-1', 'actor-id', {
          userId: 'target-user-id',
          roleId: 'role-owner-id',
          branchId: 'branch-1',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.roleAssignment.create).not.toHaveBeenCalled();
    });

    it('successfully assigns a branch-scoped role (Manager) when branchId is provided', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-mgr-id',
        name: SYSTEM_ROLES.MANAGER,
        isSystemRole: true,
      });
      mockPrisma.roleAssignment.findFirst.mockResolvedValue(null);
      mockPrisma.roleAssignment.create.mockResolvedValue({
        id: 'new-assignment-id',
        role: { id: 'role-mgr-id', name: SYSTEM_ROLES.MANAGER },
        user: { id: 'target-user-id', firstName: 'John', lastName: 'Doe' },
        branch: { id: 'branch-1', name: 'Branch A' },
      });

      const result = await service.assignToUser('org-1', 'actor-id', {
        userId: 'target-user-id',
        roleId: 'role-mgr-id',
        branchId: 'branch-1',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.roleAssignment.create).toHaveBeenCalledWith({
        data: { userId: 'target-user-id', roleId: 'role-mgr-id', branchId: 'branch-1' },
        include: expect.any(Object),
      });
    });

    it('throws BadRequestException when assigning branch-scoped role (Manager) without a branchId', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-mgr-id',
        name: SYSTEM_ROLES.MANAGER,
        isSystemRole: true,
      });

      await expect(
        service.assignToUser('org-1', 'actor-id', {
          userId: 'target-user-id',
          roleId: 'role-mgr-id',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.roleAssignment.create).not.toHaveBeenCalled();
    });
  });

  describe('removeAssignment', () => {
    it('successfully removes an Owner assignment when another Owner exists', async () => {
      mockPrisma.roleAssignment.findFirst.mockResolvedValue({
        id: 'assignment-id',
        role: { id: 'role-owner-id', name: SYSTEM_ROLES.OWNER, isSystemRole: true },
        user: { id: 'target-user-id', email: 'owner2@org.com' },
      });
      mockPrisma.roleAssignment.count.mockResolvedValue(2);

      await service.removeAssignment('org-1', 'assignment-id', 'actor-id');

      expect(mockPrisma.roleAssignment.delete).toHaveBeenCalledWith({
        where: { id: 'assignment-id' },
      });
    });

    it('throws BadRequestException when trying to remove the last Owner assignment', async () => {
      mockPrisma.roleAssignment.findFirst.mockResolvedValue({
        id: 'assignment-id',
        role: { id: 'role-owner-id', name: SYSTEM_ROLES.OWNER, isSystemRole: true },
        user: { id: 'target-user-id', email: 'owner1@org.com' },
      });
      mockPrisma.roleAssignment.count.mockResolvedValue(1);

      await expect(service.removeAssignment('org-1', 'assignment-id', 'actor-id')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.roleAssignment.delete).not.toHaveBeenCalled();
    });

    it('successfully removes non-Owner system role assignments even if it is the only one', async () => {
      mockPrisma.roleAssignment.findFirst.mockResolvedValue({
        id: 'assignment-id',
        role: { id: 'role-admin-id', name: SYSTEM_ROLES.ADMIN, isSystemRole: true },
        user: { id: 'target-user-id', email: 'admin@org.com' },
      });

      await service.removeAssignment('org-1', 'assignment-id', 'actor-id');

      expect(mockPrisma.roleAssignment.delete).toHaveBeenCalledWith({
        where: { id: 'assignment-id' },
      });
      expect(mockPrisma.roleAssignment.count).not.toHaveBeenCalled();
    });
  });
});
