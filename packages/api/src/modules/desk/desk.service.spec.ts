import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeskService } from './desk.service';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

vi.mock('../../common/rbac/org-owner.util', () => ({
  userIsOrganizationSupervisor: vi.fn(),
}));

vi.mock('../../common/rbac/effective-branch-scope', () => ({
  resolveAllowedBranchIds: vi.fn(),
}));

vi.mock('../../common/rbac/role-assignment-authorization', () => ({
  resolveUserHighestSystemRole: vi.fn(),
}));

import { userIsOrganizationSupervisor } from '../../common/rbac/org-owner.util';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import { resolveUserHighestSystemRole } from '../../common/rbac/role-assignment-authorization';

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  desk: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  branch: { findFirst: vi.fn() },
  user: { findFirst: vi.fn(), findMany: vi.fn() },
  roleAssignment: { count: vi.fn(), findFirst: vi.fn() },
};

describe('DeskService', () => {
  let service: DeskService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(true);
    vi.mocked(resolveAllowedBranchIds).mockResolvedValue(['branch-1']);
    service = new DeskService(mockPrisma as never);
  });

  describe('list', () => {
    it('returns desks for an org', async () => {
      const desks = [{ id: 'desk-1', number: '1' }];
      mockPrisma.desk.findMany.mockResolvedValue(desks);

      const result = await service.list('org-1');

      expect(result).toEqual(desks);
      expect(mockPrisma.desk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } }),
      );
    });

    it('filters by branchId when provided', async () => {
      mockPrisma.desk.findMany.mockResolvedValue([]);

      await service.list('org-1', { branchId: 'branch-1' });

      expect(mockPrisma.desk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1', branchId: 'branch-1' } }),
      );
    });

    it('restricts staff to assigned desks when not supervisor', async () => {
      vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(false);
      mockPrisma.desk.findMany
        .mockResolvedValueOnce([{ id: 'desk-a' }])
        .mockResolvedValueOnce([{ id: 'desk-a', number: '1' }]);

      const result = await service.list('org-1', { branchId: 'branch-1', viewerUserId: 'john' });

      expect(result).toEqual([{ id: 'desk-a', number: '1' }]);
      expect(mockPrisma.desk.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            branchId: 'branch-1',
            assignedUsers: { some: { id: 'john' } },
          }),
        }),
      );
      expect(mockPrisma.desk.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { orgId: 'org-1', branchId: 'branch-1', id: { in: ['desk-a'] } },
        }),
      );
    });

    it('rejects staff list when they have no desk assignments in branch', async () => {
      vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(false);
      mockPrisma.desk.findMany.mockResolvedValueOnce([]);

      await expect(
        service.list('org-1', { branchId: 'branch-b', viewerUserId: 'john' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getById', () => {
    it('returns desk when found', async () => {
      const desk = { id: 'desk-1', orgId: 'org-1', branchId: 'b1' };
      mockPrisma.desk.findFirst.mockResolvedValue(desk);

      expect(await service.getById('org-1', 'desk-1')).toEqual(desk);
    });

    it('forbids staff viewing a desk they are not assigned to when branch is scoped', async () => {
      vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(false);
      const desk = { id: 'desk-2', orgId: 'org-1', branchId: 'b1' };
      mockPrisma.desk.findFirst.mockResolvedValue(desk);
      mockPrisma.desk.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await expect(service.getById('org-1', 'desk-2', 'john')).rejects.toThrow(ForbiddenException);
    });

    it('rejects staff viewing desks in a branch with no assignments', async () => {
      vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(false);
      const desk = { id: 'desk-2', orgId: 'org-1', branchId: 'b1' };
      mockPrisma.desk.findFirst.mockResolvedValue(desk);
      mockPrisma.desk.count.mockResolvedValueOnce(0);

      await expect(service.getById('org-1', 'desk-2', 'john')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates a desk successfully', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.desk.findFirst.mockResolvedValue(null);
      const created = { id: 'desk-new', number: '5' };
      mockPrisma.desk.create.mockResolvedValue(created);

      const result = await service.create('org-1', {
        branchId: 'branch-1',
        name: 'Desk 5',
        number: '5',
      });

      expect(result).toEqual(created);
      expect(mockPrisma.desk.create).toHaveBeenCalledOnce();
    });

    it('throws NotFoundException when branch does not exist', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.create('org-1', { branchId: 'no-branch', name: 'X', number: '1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when desk number already exists', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
      mockPrisma.desk.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('org-1', { branchId: 'branch-1', name: 'Dup', number: '1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates desk status', async () => {
      mockPrisma.desk.findFirst.mockResolvedValue({ id: 'desk-1', branchId: 'b1' });
      const updated = { id: 'desk-1', status: 'open' };
      mockPrisma.desk.update.mockResolvedValue(updated);

      expect(await service.update('org-1', 'desk-1', { status: 'open' })).toEqual(updated);
    });

    it('allows assigned staff to toggle desk status', async () => {
      vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(false);
      mockPrisma.desk.count.mockResolvedValue(1);
      mockPrisma.desk.findFirst.mockResolvedValue({
        id: 'desk-1',
        branchId: 'branch-1',
        assignedUsers: [{ id: 'staff-1' }],
      });
      const updated = { id: 'desk-1', status: 'open' };
      mockPrisma.desk.update.mockResolvedValue(updated);

      await expect(
        service.update('org-1', 'desk-1', { status: 'open' }, 'staff-1'),
      ).resolves.toEqual(updated);
    });

    it('forbids assigned staff from renaming or reconfiguring desks', async () => {
      vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(false);
      mockPrisma.desk.count.mockResolvedValue(1);
      mockPrisma.desk.findFirst.mockResolvedValue({
        id: 'desk-1',
        branchId: 'branch-1',
        assignedUsers: [{ id: 'staff-1' }],
      });

      await expect(
        service.update('org-1', 'desk-1', { name: 'Teller 1' }, 'staff-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.desk.update).not.toHaveBeenCalled();
    });
  });

  describe('assign', () => {
    const deskStub = {
      id: 'desk-1',
      branchId: 'branch-1',
      number: '1',
      name: 'D1',
      branch: { id: 'branch-1', name: 'Main' },
      assignedUsers: [],
    };

    beforeEach(() => {
      mockPrisma.desk.findFirst.mockResolvedValue(deskStub);
      mockPrisma.desk.update.mockResolvedValue({ ...deskStub, assignedUsers: [{ id: 'user-1' }] });
      vi.mocked(resolveUserHighestSystemRole).mockImplementation(async (_p, _o, uid: string) => {
        const map: Record<string, string> = {
          'actor-admin': 'admin',
          'actor-mgr': 'manager',
          'actor-staff': 'staff',
          'user-1': 'staff',
          'user-mgr': 'manager',
        };
        return (map[uid] as never) ?? null;
      });
      vi.mocked(resolveAllowedBranchIds).mockResolvedValue(['branch-1']);
      mockPrisma.roleAssignment.count.mockResolvedValue(1);
      mockPrisma.roleAssignment.findFirst.mockResolvedValue({ id: 'ra-1' });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
    });

    it('assigns staff users to a desk', async () => {
      const result = await service.assign('org-1', 'actor-admin', 'desk-1', ['user-1']);
      expect(result.assignedUsers).toHaveLength(1);
    });

    it('unassigns all users when userIds is empty', async () => {
      mockPrisma.desk.update.mockResolvedValue({ ...deskStub, assignedUsers: [] });
      const result = await service.assign('org-1', 'actor-mgr', 'desk-1', []);
      expect(result.assignedUsers).toHaveLength(0);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('forbids staff from assigning agents', async () => {
      await expect(service.assign('org-1', 'actor-staff', 'desk-1', ['user-1'])).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.desk.update).not.toHaveBeenCalled();
    });

    it('forbids assigning supervisor roles to desk scope', async () => {
      vi.mocked(resolveUserHighestSystemRole).mockImplementation(async (_p, _o, uid: string) => {
        if (uid === 'actor-admin') return 'admin' as never;
        return 'manager' as never;
      });

      await expect(service.assign('org-1', 'actor-admin', 'desk-1', ['user-mgr'])).rejects.toThrow(
        /staff or viewer/i,
      );
      expect(mockPrisma.desk.update).not.toHaveBeenCalled();
    });

    it('manager cannot assign on desks outside their branches', async () => {
      vi.mocked(resolveAllowedBranchIds).mockResolvedValue(['other-branch']);

      await expect(service.assign('org-1', 'actor-mgr', 'desk-1', ['user-1'])).rejects.toThrow(
        /within their branches/i,
      );
      expect(mockPrisma.desk.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a desk', async () => {
      mockPrisma.desk.findFirst.mockResolvedValue({ id: 'desk-1', branchId: 'b1' });
      mockPrisma.desk.delete.mockResolvedValue(undefined);

      await expect(service.delete('org-1', 'desk-1')).resolves.toBeUndefined();
      expect(mockPrisma.desk.delete).toHaveBeenCalledWith({ where: { id: 'desk-1' } });
    });
  });
});
