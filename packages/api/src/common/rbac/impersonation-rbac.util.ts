import {
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  isOwnerOrAdminSystemRole,
  normalizeSystemRoleName,
  type SystemRole,
} from '@queueplatform/shared';

type ImpersonationUser = {
  impersonation?: boolean;
  orgSlug?: string;
  actAsRole?: string;
  actAsBranchId?: string;
};

/** Full RBAC bypass — support/debug when no simulated role is chosen. */
export function isFullImpersonationBypass(user: ImpersonationUser | undefined | null): boolean {
  return (
    user?.impersonation === true && user.orgSlug === 'queueplatform-internal' && !user.actAsRole
  );
}

export function isRoleSimulationImpersonation(
  user: ImpersonationUser | undefined | null,
): user is ImpersonationUser & { actAsRole: string } {
  return (
    user?.impersonation === true &&
    user.orgSlug === 'queueplatform-internal' &&
    Boolean(user.actAsRole)
  );
}

export function impersonationSimulatesOwner(user: ImpersonationUser | undefined | null): boolean {
  if (isFullImpersonationBypass(user)) return true;
  return normalizeSystemRoleName(user?.actAsRole) === SYSTEM_ROLES.OWNER;
}

export function impersonationSimulatesOwnerOrAdmin(
  user: ImpersonationUser | undefined | null,
): boolean {
  if (isFullImpersonationBypass(user)) return true;
  return isOwnerOrAdminSystemRole(user?.actAsRole);
}

type SimulatedRoleAssignment = {
  branchId: string | null;
  role: {
    rolePermissions: Array<{
      permission: { resource: string; action: string; scope: string };
    }>;
  };
};

/** Synthetic role assignments for platform-operator role simulation sessions. */
export function buildSimulatedRoleAssignments(
  roleName: SystemRole,
  branchId: string | null,
): SimulatedRoleAssignment[] {
  const permissions = DEFAULT_ROLE_PERMISSIONS[roleName];
  const branchScoped =
    roleName === SYSTEM_ROLES.MANAGER ||
    roleName === SYSTEM_ROLES.STAFF ||
    roleName === SYSTEM_ROLES.VIEWER;

  return [
    {
      branchId: branchScoped ? branchId : null,
      role: {
        rolePermissions: permissions.map((permission) => ({
          permission: {
            resource: permission.resource,
            action: permission.action,
            scope: permission.scope,
          },
        })),
      },
    },
  ];
}

export function branchScopedImpersonationRole(roleName: SystemRole): boolean {
  return (
    roleName === SYSTEM_ROLES.MANAGER ||
    roleName === SYSTEM_ROLES.STAFF ||
    roleName === SYSTEM_ROLES.VIEWER
  );
}
