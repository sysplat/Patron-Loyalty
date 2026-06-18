"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_ROLE_RANK = void 0;
exports.normalizeSystemRoleName = normalizeSystemRoleName;
exports.isOwnerOrAdminSystemRole = isOwnerOrAdminSystemRole;
exports.isSupervisorSystemRole = isSupervisorSystemRole;
exports.roleMayUseFifoManualCall = roleMayUseFifoManualCall;
exports.systemRoleRank = systemRoleRank;
exports.actorMayAssignRoles = actorMayAssignRoles;
exports.canActorAssignRole = canActorAssignRole;
exports.canActorManageUserWithRole = canActorManageUserWithRole;
exports.assignableSystemRoleNames = assignableSystemRoleNames;
exports.assignRoleForbiddenMessage = assignRoleForbiddenMessage;
exports.manageUserForbiddenMessage = manageUserForbiddenMessage;
exports.mayReceiveDeskScopedAssignment = mayReceiveDeskScopedAssignment;
const roles_1 = require("../constants/roles");
/** Higher rank = more privilege. Used for assign/manage hierarchy. */
exports.SYSTEM_ROLE_RANK = {
    [roles_1.SYSTEM_ROLES.OWNER]: 5,
    [roles_1.SYSTEM_ROLES.ADMIN]: 4,
    [roles_1.SYSTEM_ROLES.MANAGER]: 3,
    [roles_1.SYSTEM_ROLES.STAFF]: 2,
    [roles_1.SYSTEM_ROLES.VIEWER]: 1,
};
const ORDERED_ROLES = [
    roles_1.SYSTEM_ROLES.OWNER,
    roles_1.SYSTEM_ROLES.ADMIN,
    roles_1.SYSTEM_ROLES.MANAGER,
    roles_1.SYSTEM_ROLES.STAFF,
    roles_1.SYSTEM_ROLES.VIEWER,
];
function normalizeSystemRoleName(name) {
    const n = String(name ?? '')
        .trim()
        .toLowerCase();
    return ORDERED_ROLES.includes(n) ? n : null;
}
/** True when the role name is organization owner or admin. */
function isOwnerOrAdminSystemRole(roleName) {
    const role = normalizeSystemRoleName(roleName);
    return role === roles_1.SYSTEM_ROLES.OWNER || role === roles_1.SYSTEM_ROLES.ADMIN;
}
/** True when the role name is owner/admin/manager (supervisor tier). */
function isSupervisorSystemRole(roleName) {
    const role = normalizeSystemRoleName(roleName);
    return (role === roles_1.SYSTEM_ROLES.OWNER || role === roles_1.SYSTEM_ROLES.ADMIN || role === roles_1.SYSTEM_ROLES.MANAGER);
}
/** Row-level Call on FIFO / ready_then_fifo queues (owner, admin, manager). Staff use Call Next. */
function roleMayUseFifoManualCall(roleName) {
    return isSupervisorSystemRole(roleName);
}
function systemRoleRank(roleName) {
    const role = normalizeSystemRoleName(roleName);
    return role ? exports.SYSTEM_ROLE_RANK[role] : 0;
}
/** Staff and viewer cannot assign roles or manage others' assignments. */
function actorMayAssignRoles(actorRole) {
    const role = normalizeSystemRoleName(actorRole);
    if (!role)
        return false;
    return (role === roles_1.SYSTEM_ROLES.OWNER || role === roles_1.SYSTEM_ROLES.ADMIN || role === roles_1.SYSTEM_ROLES.MANAGER);
}
/**
 * True when actor may assign `targetRole` to another user.
 * Owner → any role; admin → admin and below; manager → manager and below; staff/viewer → none.
 */
function canActorAssignRole(actorRole, targetRole) {
    if (!actorMayAssignRoles(actorRole))
        return false;
    const actor = normalizeSystemRoleName(actorRole);
    if (!actor)
        return false;
    const target = normalizeSystemRoleName(targetRole);
    // Custom (non-system) roles: owner/admin/manager may assign; hierarchy applies only to system roles.
    if (!target)
        return true;
    return exports.SYSTEM_ROLE_RANK[target] <= exports.SYSTEM_ROLE_RANK[actor];
}
function canActorManageUserWithRole(actorRole, targetUserRole) {
    if (!actorMayAssignRoles(actorRole))
        return false;
    const actor = normalizeSystemRoleName(actorRole);
    if (!actor)
        return false;
    const target = normalizeSystemRoleName(targetUserRole);
    if (!target)
        return true;
    if (actor === roles_1.SYSTEM_ROLES.OWNER)
        return true;
    return exports.SYSTEM_ROLE_RANK[target] < exports.SYSTEM_ROLE_RANK[actor];
}
/** Role names an actor may pick when inviting or editing a user. */
function assignableSystemRoleNames(actorRole) {
    if (!actorMayAssignRoles(actorRole))
        return [];
    const actor = normalizeSystemRoleName(actorRole);
    if (!actor)
        return [];
    const maxRank = exports.SYSTEM_ROLE_RANK[actor];
    return ORDERED_ROLES.filter((r) => exports.SYSTEM_ROLE_RANK[r] <= maxRank);
}
function assignRoleForbiddenMessage(actorRole, targetRole) {
    const actor = normalizeSystemRoleName(actorRole);
    const target = normalizeSystemRoleName(targetRole);
    if (!actorMayAssignRoles(actorRole)) {
        return 'Your role cannot assign or change team member roles.';
    }
    if (target === roles_1.SYSTEM_ROLES.OWNER && actor !== roles_1.SYSTEM_ROLES.OWNER) {
        return 'Only an organization owner may assign the owner role.';
    }
    if (target === roles_1.SYSTEM_ROLES.ADMIN && actor === roles_1.SYSTEM_ROLES.MANAGER) {
        return 'Managers cannot assign the admin role.';
    }
    return `You cannot assign the ${target ?? 'selected'} role with your current permissions.`;
}
function manageUserForbiddenMessage(actorRole, targetUserRole) {
    if (!actorMayAssignRoles(actorRole)) {
        return 'Your role cannot manage other team members.';
    }
    const actor = normalizeSystemRoleName(actorRole);
    const target = normalizeSystemRoleName(targetUserRole);
    if (target === roles_1.SYSTEM_ROLES.OWNER && actor !== roles_1.SYSTEM_ROLES.OWNER) {
        return 'Only an organization owner may modify an owner account.';
    }
    if (target === roles_1.SYSTEM_ROLES.ADMIN && actor === roles_1.SYSTEM_ROLES.MANAGER) {
        return 'Managers cannot modify admin accounts.';
    }
    if (actor &&
        target &&
        exports.SYSTEM_ROLE_RANK[target] >= exports.SYSTEM_ROLE_RANK[actor] &&
        actor !== roles_1.SYSTEM_ROLES.OWNER) {
        return `Your role (${actor}) does not have permission to manage team members with equal or higher roles.`;
    }
    return 'You cannot manage this team member with your current role.';
}
/** Desk/station scoping applies only to frontline read roles (not supervisors). */
function mayReceiveDeskScopedAssignment(roleName) {
    const role = normalizeSystemRoleName(roleName);
    return role === roles_1.SYSTEM_ROLES.STAFF || role === roles_1.SYSTEM_ROLES.VIEWER;
}
//# sourceMappingURL=role-assignment-hierarchy.js.map