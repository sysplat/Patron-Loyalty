import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** When true, branch-scoped READ permissions may pass even if no branchId is on the request (list endpoints); data must still be filtered in services. */
export const BRANCH_SCOPED_LIST_READ_KEY = 'rbac:branchScopedListRead';

export interface RequiredPermission {
  resource: string;
  action: string;
}

/**
 * Decorator to require specific permissions on a route.
 * Usage: @RequirePermissions({ resource: 'queue', action: 'manage' })
 * Usage: @RequirePermissions({ resource: 'ticket', action: 'create' }, { resource: 'ticket', action: 'read' })
 */
export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const AllowBranchScopedListRead = () => SetMetadata(BRANCH_SCOPED_LIST_READ_KEY, true);
