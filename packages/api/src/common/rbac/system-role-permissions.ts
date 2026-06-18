import {
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLE_DESCRIPTIONS,
  SYSTEM_ROLES,
  type SystemRole,
} from '@queueplatform/shared';

type RoleSyncClient = {
  permission: {
    createMany(args: {
      data: Array<{ resource: string; action: string; scope: string }>;
      skipDuplicates: true;
    }): Promise<unknown>;
    upsert(args: {
      where: { resource_action_scope: { resource: string; action: string; scope: string } };
      update: Record<string, never>;
      create: { resource: string; action: string; scope: string };
    }): Promise<unknown>;
    findMany(args: {
      where: {
        OR: Array<{ resource: string; action: string; scope: string }>;
      };
      select: { id: true; resource: true; action: true; scope: true };
    }): Promise<Array<{ id: string; resource: string; action: string; scope: string }>>;
  };
  role: {
    findMany(args: {
      where: { orgId: string; name: { in: SystemRole[] } };
      select: { id: true; name: true };
    }): Promise<Array<{ id: string; name: string }>>;
    create(args: {
      data: { orgId: string; name: SystemRole; isSystemRole: true; description: string };
      select: { id: true; name: true };
    }): Promise<{ id: string; name: string }>;
  };
  rolePermission: {
    deleteMany(args: { where: { roleId: string } }): Promise<unknown>;
    createMany(args: {
      data: Array<{ roleId: string; permissionId: string }>;
      skipDuplicates: true;
    }): Promise<unknown>;
    findMany(args: {
      where: { roleId: string };
      select: { permissionId: true };
    }): Promise<Array<{ permissionId: string }>>;
  };
};

const SYSTEM_ROLE_NAMES = Object.values(SYSTEM_ROLES) as SystemRole[];

function permissionKey(resource: string, action: string, scope: string): string {
  return `${resource}:${action}:${scope}`;
}

export async function syncSystemRolePermissions(
  tx: RoleSyncClient,
  orgId: string,
  skipPermissionUpsert = false,
): Promise<Record<SystemRole, string>> {
  const uniquePermissions = new Map<string, { resource: string; action: string; scope: string }>();

  for (const roleName of SYSTEM_ROLE_NAMES) {
    for (const permission of DEFAULT_ROLE_PERMISSIONS[roleName]) {
      uniquePermissions.set(
        permissionKey(permission.resource, permission.action, permission.scope),
        permission,
      );
    }
  }

  if (!skipPermissionUpsert) {
    await tx.permission.createMany({
      data: [...uniquePermissions.values()],
      skipDuplicates: true,
    });
  }

  const existingRoles = await tx.role.findMany({
    where: { orgId, name: { in: SYSTEM_ROLE_NAMES } },
    select: { id: true, name: true },
  });

  const roleIds = new Map<SystemRole, string>();
  for (const role of existingRoles) {
    roleIds.set(role.name as SystemRole, role.id);
  }

  for (const roleName of SYSTEM_ROLE_NAMES) {
    if (roleIds.has(roleName)) continue;

    const createdRole = await tx.role.create({
      data: {
        orgId,
        name: roleName,
        isSystemRole: true,
        description: SYSTEM_ROLE_DESCRIPTIONS[roleName],
      },
      select: { id: true, name: true },
    });
    roleIds.set(createdRole.name as SystemRole, createdRole.id);
  }

  const permissions = await tx.permission.findMany({
    where: {
      OR: [...uniquePermissions.values()],
    },
    select: { id: true, resource: true, action: true, scope: true },
  });

  const permissionIds = new Map<string, string>();
  for (const permission of permissions) {
    permissionIds.set(
      permissionKey(permission.resource, permission.action, permission.scope),
      permission.id,
    );
  }

  for (const roleName of SYSTEM_ROLE_NAMES) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;

    const desiredPermissionIds = DEFAULT_ROLE_PERMISSIONS[roleName]
      .map((permission) =>
        permissionIds.get(permissionKey(permission.resource, permission.action, permission.scope)),
      )
      .filter((permissionId): permissionId is string => Boolean(permissionId))
      .sort();

    // Optimization: Fetch existing role permissions to check for diff
    const existingRolePermissions = await tx.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
    const existingPermissionIds = existingRolePermissions
      .map((rp: { permissionId: string }) => rp.permissionId)
      .sort();

    // Only sync if there is a difference
    if (JSON.stringify(desiredPermissionIds) !== JSON.stringify(existingPermissionIds)) {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });
      await tx.rolePermission.createMany({
        data: desiredPermissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return Object.fromEntries(roleIds.entries()) as Record<SystemRole, string>;
}
