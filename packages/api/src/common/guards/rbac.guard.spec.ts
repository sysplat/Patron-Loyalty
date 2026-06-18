import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { BRANCH_SCOPED_LIST_READ_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RbacGuard } from './rbac.guard';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

function reflectorPermissions(permissions: unknown) {
  return (key: string) => {
    if (key === PERMISSIONS_KEY) return permissions;
    if (key === BRANCH_SCOPED_LIST_READ_KEY) return false;
    return undefined;
  };
}

const mockReflector = {
  getAllAndOverride: vi.fn(),
};

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  roleAssignment: { findMany: vi.fn() },
  user: { findFirst: vi.fn() },
  branchService: { findMany: vi.fn() },
  service: { findFirst: vi.fn() },
  branch: { findFirst: vi.fn() },
  queue: { findFirst: vi.fn() }, // reused for branch inference from queueId (call-next etc.)
  ticket: { findFirst: vi.fn() },
  appointment: { findFirst: vi.fn() },
  desk: { findFirst: vi.fn() },
  displayDevice: { findFirst: vi.fn() },
  announcement: { findFirst: vi.fn() },
};

describe('RbacGuard', () => {
  let guard: RbacGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    guard = new RbacGuard(mockReflector as never, mockPrisma as never);
  });

  it('allows org-scoped permissions for org-level routes', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      reflectorPermissions([{ resource: 'billing', action: 'read' }]),
    );
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      {
        branchId: null,
        role: {
          rolePermissions: [
            {
              permission: {
                resource: 'billing',
                action: 'read',
                scope: 'org',
              },
            },
          ],
        },
      },
    ]);

    const request = {
      user: { userId: 'user-1', orgId: 'org-1' },
      params: {},
      body: {},
      query: {},
      route: { path: 'subscription' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('allows branch-scoped permissions when the branch is resolved from the target resource', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      reflectorPermissions([{ resource: 'ticket', action: 'update' }]),
    );
    mockPrisma.ticket.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      {
        branchId: 'branch-1',
        role: {
          rolePermissions: [
            {
              permission: {
                resource: 'ticket',
                action: 'update',
                scope: 'branch',
              },
            },
          ],
        },
      },
    ]);

    const request = {
      user: { userId: 'user-1', orgId: 'org-1' },
      params: { id: 'ticket-1' },
      body: {},
      query: {},
      route: { path: ':id/cancel' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(mockPrisma.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: 'ticket-1', orgId: 'org-1' },
      select: { branchId: true },
    });
  });

  it('resolves branch from body.ticketId for workbench actions without :id params', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      reflectorPermissions([{ resource: 'ticket', action: 'update' }]),
    );
    mockPrisma.ticket.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      {
        branchId: 'branch-1',
        role: {
          rolePermissions: [
            {
              permission: {
                resource: 'ticket',
                action: 'update',
                scope: 'branch',
              },
            },
          ],
        },
      },
    ]);

    const request = {
      user: { userId: 'staff-1', orgId: 'org-1' },
      params: {},
      body: { ticketId: 'ticket-abc', stationProfileId: 'profile-1', deskNumber: '1' },
      query: {},
      route: { path: 'actions/call-specific' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(mockPrisma.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: 'ticket-abc', orgId: 'org-1' },
      select: { branchId: true },
    });
  });

  it('resolves branch from body.queueId for ticket endpoints without :id params', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      reflectorPermissions([{ resource: 'ticket', action: 'update' }]),
    );
    mockPrisma.queue.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      {
        branchId: null,
        role: {
          rolePermissions: [
            {
              permission: {
                resource: 'ticket',
                action: 'update',
                scope: 'branch',
              },
            },
          ],
        },
      },
    ]);

    const request = {
      user: { userId: 'user-1', orgId: 'org-1' },
      params: {},
      body: { queueId: 'queue-xyz', deskNumber: '1' },
      query: {},
      route: { path: 'call-next' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(mockPrisma.queue.findFirst).toHaveBeenCalledWith({
      where: { id: 'queue-xyz', orgId: 'org-1' },
      select: { branchId: true },
    });
  });

  it('rejects own-scoped permissions for another user record', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      reflectorPermissions([{ resource: 'user', action: 'read' }]),
    );
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-2' });
    let rbacAssignmentCall = 0;
    mockPrisma.roleAssignment.findMany.mockImplementation(async () => {
      rbacAssignmentCall += 1;
      if (rbacAssignmentCall === 1) {
        return [];
      }
      return [
        {
          branchId: null,
          role: {
            rolePermissions: [
              {
                permission: {
                  resource: 'user',
                  action: 'read',
                  scope: 'own',
                },
              },
            ],
          },
        },
      ];
    });

    const request = {
      user: { userId: 'user-1', orgId: 'org-1' },
      params: { id: 'user-2' },
      body: {},
      query: {},
      route: { path: ':id' },
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('denies org-scoped permissions when the assignment is branch-tied (no org-wide hat)', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      reflectorPermissions([{ resource: 'billing', action: 'read' }]),
    );
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      {
        branchId: 'branch-1',
        role: {
          rolePermissions: [
            {
              permission: {
                resource: 'billing',
                action: 'read',
                scope: 'org',
              },
            },
          ],
        },
      },
    ]);

    const request = {
      user: { userId: 'user-1', orgId: 'org-1' },
      params: {},
      body: {},
      query: {},
      route: { path: 'subscription' },
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('allows platform impersonation sessions without evaluating role assignments', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      reflectorPermissions([{ resource: 'ticket', action: 'update' }]),
    );

    const request = {
      user: {
        userId: 'op-1',
        orgId: 'org-1',
        orgSlug: 'queueplatform-internal',
        impersonation: true,
      },
      params: {},
      body: {},
      query: {},
      route: { path: 'tickets/:id' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(mockPrisma.roleAssignment.findMany).not.toHaveBeenCalled();
  });

  it('enforces simulated viewer role during impersonation', async () => {
    mockReflector.getAllAndOverride.mockImplementation(
      reflectorPermissions([{ resource: 'ticket', action: 'update' }]),
    );

    const request = {
      user: {
        userId: 'op-1',
        orgId: 'org-1',
        orgSlug: 'queueplatform-internal',
        impersonation: true,
        actAsRole: 'viewer',
        actAsBranchId: 'branch-1',
      },
      params: { id: 'ticket-1' },
      body: {},
      query: {},
      route: { path: 'tickets/:id' },
    };

    mockPrisma.withTenant.mockImplementation(async (_orgId, cb) => cb(mockPrisma));
    mockPrisma.ticket.findFirst.mockResolvedValue({ branchId: 'branch-1' });

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.roleAssignment.findMany).not.toHaveBeenCalled();
  });
});

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getHandler: () => 'handler',
    getClass: () => class TestController {},
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
    switchToRpc: () => ({ getData: () => undefined, getContext: () => undefined }),
    switchToWs: () => ({
      getClient: () => undefined,
      getData: () => undefined,
      getPattern: () => undefined,
    }),
  } as unknown as ExecutionContext;
}
