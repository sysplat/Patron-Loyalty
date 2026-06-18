import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  RESOURCES,
  SYSTEM_ROLES,
  type SystemRole,
} from '@queueplatform/shared';
import { syncSystemRolePermissions } from './system-role-permissions';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  permission: {
    createMany: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  role: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  rolePermission: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
};

describe('syncSystemRolePermissions', () => {
  it('enforces accessibility-level invariants for owner→viewer hierarchy', () => {
    const hasPermission = (role: SystemRole, resource: string, action: string): boolean =>
      DEFAULT_ROLE_PERMISSIONS[role].some(
        (permission) => permission.resource === resource && permission.action === action,
      );

    expect(hasPermission('owner', RESOURCES.BILLING, ACTIONS.MANAGE)).toBe(true);
    expect(hasPermission('admin', RESOURCES.BILLING, ACTIONS.MANAGE)).toBe(false);
    expect(hasPermission('manager', RESOURCES.BILLING, ACTIONS.MANAGE)).toBe(false);
    expect(hasPermission('staff', RESOURCES.BILLING, ACTIONS.MANAGE)).toBe(false);
    expect(hasPermission('viewer', RESOURCES.BILLING, ACTIONS.MANAGE)).toBe(false);

    expect(hasPermission('admin', RESOURCES.ORGANIZATION, ACTIONS.READ)).toBe(true);
    expect(hasPermission('admin', RESOURCES.ORGANIZATION, ACTIONS.UPDATE)).toBe(true);
    expect(hasPermission('admin', RESOURCES.SETTINGS, ACTIONS.READ)).toBe(true);
    expect(hasPermission('admin', RESOURCES.SETTINGS, ACTIONS.UPDATE)).toBe(true);
    expect(hasPermission('owner', RESOURCES.ORGANIZATION, ACTIONS.MANAGE)).toBe(true);

    expect(hasPermission('manager', RESOURCES.REPORT, ACTIONS.READ)).toBe(true);
    expect(hasPermission('staff', RESOURCES.REPORT, ACTIONS.READ)).toBe(false);
    expect(hasPermission('viewer', RESOURCES.REPORT, ACTIONS.READ)).toBe(true);

    expect(hasPermission('staff', RESOURCES.BRANCH, ACTIONS.READ)).toBe(true);
    expect(hasPermission('staff', RESOURCES.QUEUE, ACTIONS.UPDATE)).toBe(true);
    expect(hasPermission('staff', RESOURCES.TICKET, ACTIONS.UPDATE)).toBe(true);
    expect(hasPermission('staff', RESOURCES.APPOINTMENT, ACTIONS.UPDATE)).toBe(true);
    expect(hasPermission('staff', RESOURCES.DESK, ACTIONS.READ)).toBe(true);
    expect(hasPermission('staff', RESOURCES.DESK, ACTIONS.UPDATE)).toBe(true);
    expect(hasPermission('viewer', RESOURCES.TICKET, ACTIONS.UPDATE)).toBe(false);
    expect(hasPermission('viewer', RESOURCES.APPOINTMENT, ACTIONS.UPDATE)).toBe(false);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.permission.createMany.mockResolvedValue(undefined);
    mockPrisma.permission.upsert.mockResolvedValue(undefined);
    mockPrisma.rolePermission.findMany.mockResolvedValue([]);
    mockPrisma.rolePermission.deleteMany.mockResolvedValue(undefined);
    mockPrisma.rolePermission.createMany.mockResolvedValue(undefined);
  });

  it('creates missing system roles and synchronizes each role permission set', async () => {
    mockPrisma.role.findMany.mockResolvedValue([{ id: 'role-owner', name: SYSTEM_ROLES.OWNER }]);

    const createdRoleIds: Record<Exclude<SystemRole, 'owner'>, string> = {
      admin: 'role-admin',
      manager: 'role-manager',
      staff: 'role-staff',
      viewer: 'role-viewer',
    };

    mockPrisma.role.create.mockImplementation(
      async ({ data }: { data: { name: Exclude<SystemRole, 'owner'> } }) => ({
        id: createdRoleIds[data.name],
        name: data.name,
      }),
    );

    const uniquePermissions = dedupePermissions();
    mockPrisma.permission.findMany.mockResolvedValue(
      uniquePermissions.map((permission, index) => ({
        id: `perm-${index}`,
        ...permission,
      })),
    );

    const roleIds = await syncSystemRolePermissions(mockPrisma as never, 'org-1');

    expect(mockPrisma.permission.createMany).toHaveBeenCalledTimes(1);
    const createManyArg = mockPrisma.permission.createMany.mock.calls[0][0] as {
      data: Array<{ resource: string; action: string; scope: string }>;
      skipDuplicates: boolean;
    };
    expect(createManyArg.skipDuplicates).toBe(true);
    expect(createManyArg.data).toHaveLength(uniquePermissions.length);
    for (const p of uniquePermissions) {
      expect(createManyArg.data).toContainEqual(p);
    }
    expect(mockPrisma.permission.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.role.create).toHaveBeenCalledTimes(4);
    expect(roleIds).toEqual({
      owner: 'role-owner',
      admin: 'role-admin',
      manager: 'role-manager',
      staff: 'role-staff',
      viewer: 'role-viewer',
    });

    expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledTimes(5);
    expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledTimes(5);

    const createManyCalls = mockPrisma.rolePermission.createMany.mock.calls.map(([args]) => args);
    for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS) as Array<
      [SystemRole, (typeof DEFAULT_ROLE_PERMISSIONS)[SystemRole]]
    >) {
      const roleId = roleIds[roleName];
      const call = createManyCalls.find((args) =>
        args.data.every((entry: { roleId: string }) => entry.roleId === roleId),
      );
      expect(call, `missing sync call for role ${roleName}`).toBeDefined();
      expect(call?.data).toHaveLength(permissions.length);
      expect(call?.skipDuplicates).toBe(true);
    }
  });
});

function dedupePermissions(): Array<{ resource: string; action: string; scope: string }> {
  const seen = new Map<string, { resource: string; action: string; scope: string }>();
  for (const permissions of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
      seen.set(`${permission.resource}:${permission.action}:${permission.scope}`, permission);
    }
  }
  return [...seen.values()];
}
