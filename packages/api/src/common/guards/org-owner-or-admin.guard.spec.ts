import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { OrgOwnerOrAdminGuard } from './org-owner-or-admin.guard';

const mockUserIsOrganizationOwnerOrAdmin = vi.fn();

vi.mock('../rbac/org-owner.util', () => ({
  userIsOrganizationOwnerOrAdmin: (...args: unknown[]) =>
    mockUserIsOrganizationOwnerOrAdmin(...args),
}));

function createContext(user: Record<string, unknown> | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('OrgOwnerOrAdminGuard', () => {
  let guard: OrgOwnerOrAdminGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new OrgOwnerOrAdminGuard({} as never);
    mockUserIsOrganizationOwnerOrAdmin.mockResolvedValue(false);
  });

  it('allows organization owner or admin', async () => {
    mockUserIsOrganizationOwnerOrAdmin.mockResolvedValue(true);
    await expect(
      guard.canActivate(createContext({ userId: 'admin-1', orgId: 'org-1' })),
    ).resolves.toBe(true);
  });

  it('forbids manager, staff, and viewer', async () => {
    await expect(
      guard.canActivate(createContext({ userId: 'staff-1', orgId: 'org-1' })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      guard.canActivate(createContext({ userId: 'staff-1', orgId: 'org-1' })),
    ).rejects.toThrow(/owner or admin/i);
  });

  it('allows platform impersonation sessions', async () => {
    await expect(
      guard.canActivate(
        createContext({
          userId: 'op-1',
          orgId: 'org-1',
          orgSlug: 'queueplatform-internal',
          impersonation: true,
        }),
      ),
    ).resolves.toBe(true);
    expect(mockUserIsOrganizationOwnerOrAdmin).not.toHaveBeenCalled();
  });
});
