import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BranchService } from './branch.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

vi.mock('../billing/plan-limit.service', () => ({
  PlanLimitService: vi.fn(),
}));

vi.mock('../../common/rbac/effective-branch-scope', () => ({
  resolveAllowedBranchIds: vi.fn(),
}));

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (_orgId, cb) => cb(mockPrisma)),
  branch: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

describe('BranchService', () => {
  let service: BranchService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    service = new BranchService(
      mockPrisma as never,
      {} as never,
      {
        isEnabled: vi.fn().mockResolvedValue(false),
      } as never,
    );
  });

  describe('updateCustomerNotice', () => {
    it('updates notice buffer fields for an existing branch', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', orgId: 'org-1' });
      const updated = {
        id: 'branch-1',
        exceptionalCustomerNotice: true,
        exceptionalCustomerNoticeMinutes: 30,
      };
      mockPrisma.branch.update.mockResolvedValue(updated);

      await expect(
        service.updateCustomerNotice('org-1', 'branch-1', {
          exceptionalCustomerNotice: true,
          exceptionalCustomerNoticeMinutes: 30,
        }),
      ).resolves.toEqual(updated);

      expect(mockPrisma.branch.update).toHaveBeenCalledWith({
        where: { id: 'branch-1' },
        data: {
          exceptionalCustomerNotice: true,
          exceptionalCustomerNoticeMinutes: 30,
        },
      });
    });

    it('throws when branch does not exist', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCustomerNotice('org-1', 'missing', { exceptionalCustomerNotice: true }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.branch.update).not.toHaveBeenCalled();
    });
  });
});
