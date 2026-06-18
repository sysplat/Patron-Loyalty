import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { OrgOwnerGuard } from './org-owner.guard';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  role: { findFirst: vi.fn() },
  roleAssignment: { findFirst: vi.fn() },
};

function createContext(user: Record<string, unknown> | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('OrgOwnerGuard', () => {
  let guard: OrgOwnerGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new OrgOwnerGuard(mockPrisma as never);
    mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-owner' });
    mockPrisma.roleAssignment.findFirst.mockResolvedValue({ id: 'ra-owner' });
  });

  it('allows organization owner', async () => {
    await expect(
      guard.canActivate(createContext({ userId: 'owner-1', orgId: 'org-1' })),
    ).resolves.toBe(true);
  });

  it('forbids admin and other roles', async () => {
    mockPrisma.roleAssignment.findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(createContext({ userId: 'admin-1', orgId: 'org-1' })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      guard.canActivate(createContext({ userId: 'admin-1', orgId: 'org-1' })),
    ).rejects.toThrow(/organization owner/i);
  });

  it('allows full-access platform impersonation sessions', async () => {
    mockPrisma.roleAssignment.findFirst.mockResolvedValue(null);
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
  });

  it('forbids simulated admin on owner-only routes', async () => {
    await expect(
      guard.canActivate(
        createContext({
          userId: 'op-1',
          orgId: 'org-1',
          orgSlug: 'queueplatform-internal',
          impersonation: true,
          actAsRole: 'admin',
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
