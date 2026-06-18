import { SYSTEM_ROLES, type SystemRole } from '../constants/roles';

/** Higher rank = more privilege. Used for assign/manage hierarchy. */
export const SYSTEM_ROLE_RANK: Record<SystemRole, number> = {
  [SYSTEM_ROLES.OWNER]: 5,
  [SYSTEM_ROLES.ADMIN]: 4,
  [SYSTEM_ROLES.MANAGER]: 3,
  [SYSTEM_ROLES.STAFF]: 2,
  [SYSTEM_ROLES.VIEWER]: 1,
};

const ORDERED_ROLES: SystemRole[] = [
  SYSTEM_ROLES.OWNER,
  SYSTEM_ROLES.ADMIN,
  SYSTEM_ROLES.MANAGER,
  SYSTEM_ROLES.STAFF,
  SYSTEM_ROLES.VIEWER,
];

export function normalizeSystemRoleName(name: unknown): SystemRole | null {
  const n = String(name ?? '')
    .trim()
    .toLowerCase();
  return ORDERED_ROLES.includes(n as SystemRole) ? (n as SystemRole) : null;
}

/** True when the role name is organization owner or admin. */
export function isOwnerOrAdminSystemRole(roleName: unknown): boolean {
  const role = normalizeSystemRoleName(roleName);
  return role === SYSTEM_ROLES.OWNER || role === SYSTEM_ROLES.ADMIN;
}

/** True when the role name is owner/admin/manager (supervisor tier). */
export function isSupervisorSystemRole(roleName: unknown): boolean {
  const role = normalizeSystemRoleName(roleName);
  return (
    role === SYSTEM_ROLES.OWNER || role === SYSTEM_ROLES.ADMIN || role === SYSTEM_ROLES.MANAGER
  );
}

/** Row-level Call on FIFO / ready_then_fifo queues (owner, admin, manager). Staff use Call Next. */
export function roleMayUseFifoManualCall(roleName: unknown): boolean {
  return isSupervisorSystemRole(roleName);
}

export function systemRoleRank(roleName: unknown): number {
  const role = normalizeSystemRoleName(roleName);
  return role ? SYSTEM_ROLE_RANK[role] : 0;
}

/** Staff and viewer cannot assign roles or manage others' assignments. */
export function actorMayAssignRoles(actorRole: unknown): boolean {
  const role = normalizeSystemRoleName(actorRole);
  if (!role) return false;
  return (
    role === SYSTEM_ROLES.OWNER || role === SYSTEM_ROLES.ADMIN || role === SYSTEM_ROLES.MANAGER
  );
}

/**
 * True when actor may assign `targetRole` to another user.
 * Owner → any role; admin → admin and below; manager → manager and below; staff/viewer → none.
 */
export function canActorAssignRole(actorRole: unknown, targetRole: unknown): boolean {
  if (!actorMayAssignRoles(actorRole)) return false;
  const actor = normalizeSystemRoleName(actorRole);
  if (!actor) return false;
  const target = normalizeSystemRoleName(targetRole);
  // Custom (non-system) roles: owner/admin/manager may assign; hierarchy applies only to system roles.
  if (!target) return true;
  return SYSTEM_ROLE_RANK[target] <= SYSTEM_ROLE_RANK[actor];
}

export function canActorManageUserWithRole(actorRole: unknown, targetUserRole: unknown): boolean {
  if (!actorMayAssignRoles(actorRole)) return false;
  const actor = normalizeSystemRoleName(actorRole);
  if (!actor) return false;

  const target = normalizeSystemRoleName(targetUserRole);
  if (!target) return true;

  if (actor === SYSTEM_ROLES.OWNER) return true;

  return SYSTEM_ROLE_RANK[target] < SYSTEM_ROLE_RANK[actor];
}

/** Role names an actor may pick when inviting or editing a user. */
export function assignableSystemRoleNames(actorRole: unknown): SystemRole[] {
  if (!actorMayAssignRoles(actorRole)) return [];
  const actor = normalizeSystemRoleName(actorRole);
  if (!actor) return [];
  const maxRank = SYSTEM_ROLE_RANK[actor];
  return ORDERED_ROLES.filter((r) => SYSTEM_ROLE_RANK[r] <= maxRank);
}

export function assignRoleForbiddenMessage(actorRole: unknown, targetRole: unknown): string {
  const actor = normalizeSystemRoleName(actorRole);
  const target = normalizeSystemRoleName(targetRole);
  if (!actorMayAssignRoles(actorRole)) {
    return 'Your role cannot assign or change team member roles.';
  }
  if (target === SYSTEM_ROLES.OWNER && actor !== SYSTEM_ROLES.OWNER) {
    return 'Only an organization owner may assign the owner role.';
  }
  if (target === SYSTEM_ROLES.ADMIN && actor === SYSTEM_ROLES.MANAGER) {
    return 'Managers cannot assign the admin role.';
  }
  return `You cannot assign the ${target ?? 'selected'} role with your current permissions.`;
}

export function manageUserForbiddenMessage(actorRole: unknown, targetUserRole: unknown): string {
  if (!actorMayAssignRoles(actorRole)) {
    return 'Your role cannot manage other team members.';
  }
  const actor = normalizeSystemRoleName(actorRole);
  const target = normalizeSystemRoleName(targetUserRole);
  if (target === SYSTEM_ROLES.OWNER && actor !== SYSTEM_ROLES.OWNER) {
    return 'Only an organization owner may modify an owner account.';
  }
  if (target === SYSTEM_ROLES.ADMIN && actor === SYSTEM_ROLES.MANAGER) {
    return 'Managers cannot modify admin accounts.';
  }
  if (
    actor &&
    target &&
    SYSTEM_ROLE_RANK[target] >= SYSTEM_ROLE_RANK[actor] &&
    actor !== SYSTEM_ROLES.OWNER
  ) {
    return `Your role (${actor}) does not have permission to manage team members with equal or higher roles.`;
  }
  return 'You cannot manage this team member with your current role.';
}

/** Desk/station scoping applies only to frontline read roles (not supervisors). */
export function mayReceiveDeskScopedAssignment(roleName: unknown): boolean {
  const role = normalizeSystemRoleName(roleName);
  return role === SYSTEM_ROLES.STAFF || role === SYSTEM_ROLES.VIEWER;
}
