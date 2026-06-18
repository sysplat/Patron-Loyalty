import {
  ACTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  RESOURCES,
  SYSTEM_ROLES,
  SYSTEM_ROLE_RANK,
  actorMayAssignRoles,
  assignableSystemRoleNames,
  canActorAssignRole,
  canActorManageUserWithRole,
  type SystemRole,
  type Resource,
  type Action,
} from '@queueplatform/shared';

export {
  SYSTEM_ROLE_RANK,
  actorMayAssignRoles,
  assignableSystemRoleNames,
  canActorAssignRole,
  canActorManageUserWithRole,
};

/** Dashboard viewer role check replaced by capability-based hasPermission */
export function hasPermission(
  roleName: string | undefined | null,
  resource: Resource,
  action: Action,
): boolean {
  const key = String(roleName ?? '').toLowerCase() as SystemRole;
  if (key === SYSTEM_ROLES.OWNER) return true;
  const perms = DEFAULT_ROLE_PERMISSIONS[key];
  if (!perms) return false;
  return perms.some(
    (p) => p.resource === resource && (p.action === action || p.action === ACTIONS.MANAGE),
  );
}

/** Serve desk open/close controls require desk:update (or manage). */
export function canToggleServeDeskStatus(roleName: string | undefined | null): boolean {
  return hasPermission(roleName, RESOURCES.DESK, ACTIONS.UPDATE);
}

/** Human-readable role for sidebar/header (e.g. viewer → Viewer). */
export function formatRoleLabel(roleName: string | undefined | null): string {
  const key = String(roleName ?? SYSTEM_ROLES.VIEWER).toLowerCase();
  const labels: Record<string, string> = {
    [SYSTEM_ROLES.OWNER]: 'Owner',
    [SYSTEM_ROLES.ADMIN]: 'Admin',
    [SYSTEM_ROLES.MANAGER]: 'Manager',
    [SYSTEM_ROLES.STAFF]: 'Staff',
    [SYSTEM_ROLES.VIEWER]: 'Viewer',
  };
  return labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Prefer full name; fall back to email local-part so read-only users always see an identity label. */
export function formatUserDisplayName(
  user:
    | {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
): string {
  const full = `${user?.firstName?.trim() ?? ''} ${user?.lastName?.trim() ?? ''}`.trim();
  if (full) return full;
  const email = user?.email?.trim();
  if (email) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
    return email;
  }
  return 'Account';
}

/** Organization owner — sole role that may delete ticket history (UI + API). */
export function isOrganizationOwner(roleName: string | undefined | null): boolean {
  return String(roleName ?? '').toLowerCase() === SYSTEM_ROLES.OWNER;
}

/**
 * Whether the role may stop (close) a queue in the serve UI.
 * Re-exported from shared RBAC (owner/admin always; manager/staff when empty; viewer never).
 */
export { canStopQueue } from '@queueplatform/shared';

/** Owner or admin — may force-stop a queue while customers are still waiting. */
export function isOwnerOrAdmin(roleName: string | undefined | null): boolean {
  const r = String(roleName ?? '').toLowerCase();
  return r === SYSTEM_ROLES.OWNER || r === SYSTEM_ROLES.ADMIN;
}

/** Owner and org-wide admin see every branch in the organization (matches API `resolveAllowedBranchIds` null). */
export function canSeeAllOrgBranches(roleName: string | undefined | null): boolean {
  const r = String(roleName ?? '').toLowerCase();
  return r === SYSTEM_ROLES.OWNER || r === SYSTEM_ROLES.ADMIN;
}

/** Label for the empty branch option in filters (manager/staff/viewer vs owner/admin). */
export function branchFilterAllLabel(roleName: string | undefined | null): string {
  return canSeeAllOrgBranches(roleName) ? 'All branches' : 'All assigned branches';
}

/** Org-wide branch creation (POST /branches): org-scoped `branch` `create` or `manage` only. */
export function canCreateBranch(roleName: string | undefined | null): boolean {
  const key = String(roleName ?? '').toLowerCase() as SystemRole;
  const perms = DEFAULT_ROLE_PERMISSIONS[key];
  if (!perms) return false;
  return perms.some(
    (p) =>
      p.resource === RESOURCES.BRANCH &&
      p.scope === 'org' &&
      (p.action === ACTIONS.CREATE || p.action === ACTIONS.MANAGE),
  );
}

/** Org-wide service creation: org-scoped `service` `create` or `manage` only. */
export function canCreateService(roleName: string | undefined | null): boolean {
  const key = String(roleName ?? '').toLowerCase() as SystemRole;
  const perms = DEFAULT_ROLE_PERMISSIONS[key];
  if (!perms) return false;
  return perms.some(
    (p) =>
      p.resource === RESOURCES.SERVICE &&
      p.scope === 'org' &&
      (p.action === ACTIONS.CREATE || p.action === ACTIONS.MANAGE),
  );
}

/** Station profile admin (generate from flow, create/update/delete profiles). */
export function canManageStationProfiles(roleName: string | undefined | null): boolean {
  const key = String(roleName ?? '').toLowerCase() as SystemRole;
  const perms = DEFAULT_ROLE_PERMISSIONS[key];
  if (!perms) return false;
  return perms.some(
    (p) =>
      p.resource === RESOURCES.STATION_PROFILE &&
      (p.action === ACTIONS.CREATE ||
        p.action === ACTIONS.UPDATE ||
        p.action === ACTIONS.DELETE ||
        p.action === ACTIONS.MANAGE),
  );
}

/** Flows are restricted to owner/admin only (UI mirrors API enforcement). */
export function canAccessFlows(roleName: string | undefined | null): boolean {
  const r = String(roleName ?? '').toLowerCase();
  return r === SYSTEM_ROLES.OWNER || r === SYSTEM_ROLES.ADMIN;
}

/** Queue creation: `queue` `create` or `manage` only. */
export function canCreateQueue(roleName: string | undefined | null): boolean {
  const key = String(roleName ?? '').toLowerCase() as SystemRole;
  const perms = DEFAULT_ROLE_PERMISSIONS[key];
  if (!perms) return false;
  return perms.some(
    (p) =>
      p.resource === RESOURCES.QUEUE &&
      (p.action === ACTIONS.CREATE || p.action === ACTIONS.MANAGE),
  );
}
/** Review deletion: `review` `delete` or `manage` only. */
export function canDeleteReview(roleName: string | undefined | null): boolean {
  const key = String(roleName ?? '').toLowerCase() as SystemRole;
  const perms = DEFAULT_ROLE_PERMISSIONS[key];
  if (!perms) return false;
  return perms.some(
    (p) =>
      p.resource === RESOURCES.REVIEW &&
      (p.action === ACTIONS.DELETE || p.action === ACTIONS.MANAGE),
  );
}
