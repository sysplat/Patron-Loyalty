import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAllowedBranchIds } from './effective-branch-scope';
import { SYSTEM_ROLES } from '@queueplatform/shared';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  roleAssignment: {
    findMany: vi.fn(),
  },
};

describe('resolveAllowedBranchIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when user has org-wide owner assignment', async () => {
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      { branchId: null, role: { name: SYSTEM_ROLES.OWNER } },
    ]);

    const result = await resolveAllowedBranchIds(mockPrisma as never, 'org-1', 'user-1');

    expect(result).toBeNull();
  });

  it('returns null when user has org-wide admin assignment', async () => {
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      { branchId: null, role: { name: SYSTEM_ROLES.ADMIN } },
    ]);

    const result = await resolveAllowedBranchIds(mockPrisma as never, 'org-1', 'user-1');

    expect(result).toBeNull();
  });

  it('returns distinct branch ids for branch-only assignments', async () => {
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      { branchId: 'b1', role: { name: SYSTEM_ROLES.MANAGER } },
      { branchId: 'b2', role: { name: SYSTEM_ROLES.MANAGER } },
    ]);

    const result = await resolveAllowedBranchIds(mockPrisma as never, 'org-1', 'user-1');

    expect(result).toEqual(expect.arrayContaining(['b1', 'b2']));
    expect(result).toHaveLength(2);
  });

  it('combines branch ids when user has mixed assignments without org-wide privilege', async () => {
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      { branchId: 'b1', role: { name: SYSTEM_ROLES.STAFF } },
    ]);

    const result = await resolveAllowedBranchIds(mockPrisma as never, 'org-1', 'user-1');

    expect(result).toEqual(['b1']);
  });

  it('returns empty array when user has no role assignments', async () => {
    mockPrisma.roleAssignment.findMany.mockResolvedValue([]);

    const result = await resolveAllowedBranchIds(mockPrisma as never, 'org-1', 'user-1');

    expect(result).toEqual([]);
  });
});
