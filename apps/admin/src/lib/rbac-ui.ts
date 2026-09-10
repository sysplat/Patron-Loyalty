import {
  ACTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  RESOURCES,
  SYSTEM_ROLES,
  type SystemRole,
} from '@queueplatform/shared';

/** Dashboard viewer role: read-only; mutations must be hidden in UI (API still enforces RBAC). */
export function isViewerRole(roleName: string | undefined | null): boolean {
  return String(roleName ?? '').toLowerCase() === SYSTEM_ROLES.VIEWER;
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
