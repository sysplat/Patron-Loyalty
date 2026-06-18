"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const roles_1 = require("../constants/roles");
const role_assignment_hierarchy_1 = require("./role-assignment-hierarchy");
(0, vitest_1.describe)('role-assignment-hierarchy', () => {
    (0, vitest_1.it)('owner may assign any system role', () => {
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.OWNER, roles_1.SYSTEM_ROLES.OWNER)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.OWNER, roles_1.SYSTEM_ROLES.VIEWER)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.assignableSystemRoleNames)(roles_1.SYSTEM_ROLES.OWNER)).toHaveLength(5);
    });
    (0, vitest_1.it)('admin may assign admin and below, not owner', () => {
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.ADMIN, roles_1.SYSTEM_ROLES.ADMIN)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.ADMIN, roles_1.SYSTEM_ROLES.MANAGER)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.ADMIN, roles_1.SYSTEM_ROLES.OWNER)).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.assignableSystemRoleNames)(roles_1.SYSTEM_ROLES.ADMIN)).toEqual([
            roles_1.SYSTEM_ROLES.ADMIN,
            roles_1.SYSTEM_ROLES.MANAGER,
            roles_1.SYSTEM_ROLES.STAFF,
            roles_1.SYSTEM_ROLES.VIEWER,
        ]);
    });
    (0, vitest_1.it)('manager may assign manager and below, not admin or owner', () => {
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.MANAGER, roles_1.SYSTEM_ROLES.MANAGER)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.MANAGER, roles_1.SYSTEM_ROLES.STAFF)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.MANAGER, roles_1.SYSTEM_ROLES.ADMIN)).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.MANAGER, roles_1.SYSTEM_ROLES.OWNER)).toBe(false);
    });
    (0, vitest_1.it)('staff and viewer cannot assign roles', () => {
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.actorMayAssignRoles)(roles_1.SYSTEM_ROLES.STAFF)).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.actorMayAssignRoles)(roles_1.SYSTEM_ROLES.VIEWER)).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.STAFF, roles_1.SYSTEM_ROLES.VIEWER)).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorManageUserWithRole)(roles_1.SYSTEM_ROLES.VIEWER, roles_1.SYSTEM_ROLES.STAFF)).toBe(false);
    });
    (0, vitest_1.it)('actors cannot manage peers unless they are the owner', () => {
        // Owner can manage owner
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorManageUserWithRole)(roles_1.SYSTEM_ROLES.OWNER, roles_1.SYSTEM_ROLES.OWNER)).toBe(true);
        // Admin cannot manage admin
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorManageUserWithRole)(roles_1.SYSTEM_ROLES.ADMIN, roles_1.SYSTEM_ROLES.ADMIN)).toBe(false);
        // Manager cannot manage manager
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorManageUserWithRole)(roles_1.SYSTEM_ROLES.MANAGER, roles_1.SYSTEM_ROLES.MANAGER)).toBe(false);
    });
    (0, vitest_1.it)('assign-capable actors may assign custom (non-system) roles', () => {
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.ADMIN, 'receptionist')).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.MANAGER, 'receptionist')).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorAssignRole)(roles_1.SYSTEM_ROLES.STAFF, 'receptionist')).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorManageUserWithRole)(roles_1.SYSTEM_ROLES.ADMIN, null)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.canActorManageUserWithRole)(roles_1.SYSTEM_ROLES.STAFF, null)).toBe(false);
    });
    (0, vitest_1.it)('desk scoping applies to staff and viewer only', () => {
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.mayReceiveDeskScopedAssignment)(roles_1.SYSTEM_ROLES.STAFF)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.mayReceiveDeskScopedAssignment)(roles_1.SYSTEM_ROLES.VIEWER)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.mayReceiveDeskScopedAssignment)(roles_1.SYSTEM_ROLES.MANAGER)).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.mayReceiveDeskScopedAssignment)(roles_1.SYSTEM_ROLES.ADMIN)).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.mayReceiveDeskScopedAssignment)(roles_1.SYSTEM_ROLES.OWNER)).toBe(false);
    });
    (0, vitest_1.it)('fifo manual row call is limited to owner, admin, and manager', () => {
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.roleMayUseFifoManualCall)(roles_1.SYSTEM_ROLES.OWNER)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.roleMayUseFifoManualCall)(roles_1.SYSTEM_ROLES.ADMIN)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.roleMayUseFifoManualCall)(roles_1.SYSTEM_ROLES.MANAGER)).toBe(true);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.roleMayUseFifoManualCall)(roles_1.SYSTEM_ROLES.STAFF)).toBe(false);
        (0, vitest_1.expect)((0, role_assignment_hierarchy_1.roleMayUseFifoManualCall)(roles_1.SYSTEM_ROLES.VIEWER)).toBe(false);
    });
});
//# sourceMappingURL=role-assignment-hierarchy.spec.js.map