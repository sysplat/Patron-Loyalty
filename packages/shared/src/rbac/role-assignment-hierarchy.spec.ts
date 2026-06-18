import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLES } from '../constants/roles';
import {
  actorMayAssignRoles,
  assignableSystemRoleNames,
  canActorAssignRole,
  canActorManageUserWithRole,
  mayReceiveDeskScopedAssignment,
  roleMayUseFifoManualCall,
} from './role-assignment-hierarchy';

describe('role-assignment-hierarchy', () => {
  it('owner may assign any system role', () => {
    expect(canActorAssignRole(SYSTEM_ROLES.OWNER, SYSTEM_ROLES.OWNER)).toBe(true);
    expect(canActorAssignRole(SYSTEM_ROLES.OWNER, SYSTEM_ROLES.VIEWER)).toBe(true);
    expect(assignableSystemRoleNames(SYSTEM_ROLES.OWNER)).toHaveLength(5);
  });

  it('admin may assign admin and below, not owner', () => {
    expect(canActorAssignRole(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN)).toBe(true);
    expect(canActorAssignRole(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.MANAGER)).toBe(true);
    expect(canActorAssignRole(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.OWNER)).toBe(false);
    expect(assignableSystemRoleNames(SYSTEM_ROLES.ADMIN)).toEqual([
      SYSTEM_ROLES.ADMIN,
      SYSTEM_ROLES.MANAGER,
      SYSTEM_ROLES.STAFF,
      SYSTEM_ROLES.VIEWER,
    ]);
  });

  it('manager may assign manager and below, not admin or owner', () => {
    expect(canActorAssignRole(SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.MANAGER)).toBe(true);
    expect(canActorAssignRole(SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.STAFF)).toBe(true);
    expect(canActorAssignRole(SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.ADMIN)).toBe(false);
    expect(canActorAssignRole(SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.OWNER)).toBe(false);
  });

  it('staff and viewer cannot assign roles', () => {
    expect(actorMayAssignRoles(SYSTEM_ROLES.STAFF)).toBe(false);
    expect(actorMayAssignRoles(SYSTEM_ROLES.VIEWER)).toBe(false);
    expect(canActorAssignRole(SYSTEM_ROLES.STAFF, SYSTEM_ROLES.VIEWER)).toBe(false);
    expect(canActorManageUserWithRole(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.STAFF)).toBe(false);
  });

  it('actors cannot manage peers unless they are the owner', () => {
    // Owner can manage owner
    expect(canActorManageUserWithRole(SYSTEM_ROLES.OWNER, SYSTEM_ROLES.OWNER)).toBe(true);
    // Admin cannot manage admin
    expect(canActorManageUserWithRole(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN)).toBe(false);
    // Manager cannot manage manager
    expect(canActorManageUserWithRole(SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.MANAGER)).toBe(false);
  });

  it('assign-capable actors may assign custom (non-system) roles', () => {
    expect(canActorAssignRole(SYSTEM_ROLES.ADMIN, 'receptionist')).toBe(true);
    expect(canActorAssignRole(SYSTEM_ROLES.MANAGER, 'receptionist')).toBe(true);
    expect(canActorAssignRole(SYSTEM_ROLES.STAFF, 'receptionist')).toBe(false);
    expect(canActorManageUserWithRole(SYSTEM_ROLES.ADMIN, null)).toBe(true);
    expect(canActorManageUserWithRole(SYSTEM_ROLES.STAFF, null)).toBe(false);
  });

  it('desk scoping applies to staff and viewer only', () => {
    expect(mayReceiveDeskScopedAssignment(SYSTEM_ROLES.STAFF)).toBe(true);
    expect(mayReceiveDeskScopedAssignment(SYSTEM_ROLES.VIEWER)).toBe(true);
    expect(mayReceiveDeskScopedAssignment(SYSTEM_ROLES.MANAGER)).toBe(false);
    expect(mayReceiveDeskScopedAssignment(SYSTEM_ROLES.ADMIN)).toBe(false);
    expect(mayReceiveDeskScopedAssignment(SYSTEM_ROLES.OWNER)).toBe(false);
  });

  it('fifo manual row call is limited to owner, admin, and manager', () => {
    expect(roleMayUseFifoManualCall(SYSTEM_ROLES.OWNER)).toBe(true);
    expect(roleMayUseFifoManualCall(SYSTEM_ROLES.ADMIN)).toBe(true);
    expect(roleMayUseFifoManualCall(SYSTEM_ROLES.MANAGER)).toBe(true);
    expect(roleMayUseFifoManualCall(SYSTEM_ROLES.STAFF)).toBe(false);
    expect(roleMayUseFifoManualCall(SYSTEM_ROLES.VIEWER)).toBe(false);
  });
});
