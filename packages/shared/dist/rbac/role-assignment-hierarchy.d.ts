import { type SystemRole } from '../constants/roles';
/** Higher rank = more privilege. Used for assign/manage hierarchy. */
export declare const SYSTEM_ROLE_RANK: Record<SystemRole, number>;
export declare function normalizeSystemRoleName(name: unknown): SystemRole | null;
/** True when the role name is organization owner or admin. */
export declare function isOwnerOrAdminSystemRole(roleName: unknown): boolean;
/** True when the role name is owner/admin/manager (supervisor tier). */
export declare function isSupervisorSystemRole(roleName: unknown): boolean;
/** Row-level Call on FIFO / ready_then_fifo queues (owner, admin, manager). Staff use Call Next. */
export declare function roleMayUseFifoManualCall(roleName: unknown): boolean;
export declare function systemRoleRank(roleName: unknown): number;
/** Staff and viewer cannot assign roles or manage others' assignments. */
export declare function actorMayAssignRoles(actorRole: unknown): boolean;
/**
 * True when actor may assign `targetRole` to another user.
 * Owner → any role; admin → admin and below; manager → manager and below; staff/viewer → none.
 */
export declare function canActorAssignRole(actorRole: unknown, targetRole: unknown): boolean;
export declare function canActorManageUserWithRole(actorRole: unknown, targetUserRole: unknown): boolean;
/** Role names an actor may pick when inviting or editing a user. */
export declare function assignableSystemRoleNames(actorRole: unknown): SystemRole[];
export declare function assignRoleForbiddenMessage(actorRole: unknown, targetRole: unknown): string;
export declare function manageUserForbiddenMessage(actorRole: unknown, targetUserRole: unknown): string;
/** Desk/station scoping applies only to frontline read roles (not supervisors). */
export declare function mayReceiveDeskScopedAssignment(roleName: unknown): boolean;
//# sourceMappingURL=role-assignment-hierarchy.d.ts.map