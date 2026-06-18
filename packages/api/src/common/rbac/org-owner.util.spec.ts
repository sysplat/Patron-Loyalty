import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@queueplatform/shared';
import { userCanUseFifoManualCall, userIsOrganizationSupervisor } from './org-owner.util';

describe('userCanUseFifoManualCall', () => {
  const orgId = 'org-1';
  const userId = 'user-1';
  const branchId = 'branch-1';

  function prismaWithAssignments(
    assignments: Array<{ branchId: string | null; role: { name: string } }>,
  ) {
    return {
      role: { findFirst: vi.fn() },
      roleAssignment: {
        findMany: vi.fn().mockResolvedValue(assignments),
      },
    };
  }

  it('allows owner and admin org-wide', async () => {
    const ownerPrisma = prismaWithAssignments([
      { branchId: null, role: { name: SYSTEM_ROLES.OWNER } },
    ]);
    await expect(
      userCanUseFifoManualCall(ownerPrisma as never, orgId, userId, branchId),
    ).resolves.toBe(true);

    const adminPrisma = prismaWithAssignments([
      { branchId: null, role: { name: SYSTEM_ROLES.ADMIN } },
    ]);
    await expect(
      userCanUseFifoManualCall(adminPrisma as never, orgId, userId, branchId),
    ).resolves.toBe(true);
  });

  it('allows manager only on their assigned branch', async () => {
    const prisma = prismaWithAssignments([
      { branchId: 'branch-1', role: { name: SYSTEM_ROLES.MANAGER } },
    ]);
    await expect(
      userCanUseFifoManualCall(prisma as never, orgId, userId, 'branch-1'),
    ).resolves.toBe(true);
    await expect(
      userCanUseFifoManualCall(prisma as never, orgId, userId, 'branch-2'),
    ).resolves.toBe(false);
  });

  it('denies staff and viewer', async () => {
    const staffPrisma = prismaWithAssignments([
      { branchId: branchId, role: { name: SYSTEM_ROLES.STAFF } },
    ]);
    await expect(
      userCanUseFifoManualCall(staffPrisma as never, orgId, userId, branchId),
    ).resolves.toBe(false);

    const viewerPrisma = prismaWithAssignments([
      { branchId: branchId, role: { name: SYSTEM_ROLES.VIEWER } },
    ]);
    await expect(
      userCanUseFifoManualCall(viewerPrisma as never, orgId, userId, branchId),
    ).resolves.toBe(false);
  });
});

describe('userIsOrganizationSupervisor', () => {
  it('includes manager', async () => {
    const prisma = {
      role: { findFirst: vi.fn() },
      roleAssignment: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ branchId: 'branch-1', role: { name: SYSTEM_ROLES.MANAGER } }]),
      },
    };
    await expect(userIsOrganizationSupervisor(prisma as never, 'org-1', 'user-1')).resolves.toBe(
      true,
    );
  });
});
