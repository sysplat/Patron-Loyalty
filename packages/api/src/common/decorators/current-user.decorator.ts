import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Shape of the authenticated user attached to every JWT-protected request.
 * Populated by the JWT strategy and validated by JwtAuthGuard.
 *
 * Controllers should replace `@CurrentUser() user: any` with
 * `@CurrentUser() user: AuthenticatedUser` to get compile-time safety.
 */
export interface AuthenticatedUser {
  /** UUID of the authenticated user. */
  userId: string;
  /** Fallback User ID (some controllers reference user.id). */
  id?: string;
  /** UUID of the organization the user belongs to. */
  orgId: string;
  /** User's email address from the JWT payload. */
  email: string;
  /** User's organization slug. */
  orgSlug: string;
  /** Granted permission scopes (e.g. ['manage:org', 'read:branch']). */
  permissions?: string[];
  /** True when JWT is a platform-operator impersonation session (see JwtStrategy). */
  impersonation?: boolean;
  /** Simulated tenant role during impersonation (when RBAC is enforced). */
  actAsRole?: string;
  /** Branch scope for manager/staff/viewer simulation. */
  actAsBranchId?: string;
  /** JWT token ID for revocation tracking (specifically impersonation sessions) */
  jti?: string;
}

/**
 * Extract the authenticated user from the request.
 * Usage: @CurrentUser() user: AuthenticatedUser
 * Usage: @CurrentUser('orgId') orgId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
