import { SYSTEM_ROLES } from '@queueplatform/shared';
import { describe, expect, it } from 'vitest';
import {
  branchFilterAllLabel,
  canCreateBranch,
  canSeeAllOrgBranches,
  isViewerRole,
} from './rbac-ui';

describe('isViewerRole', () => {
  it('matches only the viewer role, case-insensitively', () => {
    expect(isViewerRole(SYSTEM_ROLES.VIEWER)).toBe(true);
    expect(isViewerRole('VIEWER')).toBe(true);
    expect(isViewerRole(SYSTEM_ROLES.OWNER)).toBe(false);
  });

  it('treats nullish/unknown roles as non-viewer', () => {
    expect(isViewerRole(null)).toBe(false);
    expect(isViewerRole(undefined)).toBe(false);
    expect(isViewerRole('receptionist')).toBe(false);
  });
});

describe('canSeeAllOrgBranches', () => {
  it('grants org-wide visibility to owner and admin only', () => {
    expect(canSeeAllOrgBranches(SYSTEM_ROLES.OWNER)).toBe(true);
    expect(canSeeAllOrgBranches(SYSTEM_ROLES.ADMIN)).toBe(true);
  });

  it('denies org-wide visibility to branch-scoped roles', () => {
    for (const role of [SYSTEM_ROLES.MANAGER, SYSTEM_ROLES.STAFF, SYSTEM_ROLES.VIEWER, null]) {
      expect(canSeeAllOrgBranches(role)).toBe(false);
    }
  });
});

describe('branchFilterAllLabel', () => {
  it('says "All branches" for org-wide roles and "All assigned branches" otherwise', () => {
    expect(branchFilterAllLabel(SYSTEM_ROLES.OWNER)).toBe('All branches');
    expect(branchFilterAllLabel(SYSTEM_ROLES.ADMIN)).toBe('All branches');
    expect(branchFilterAllLabel(SYSTEM_ROLES.MANAGER)).toBe('All assigned branches');
    expect(branchFilterAllLabel(null)).toBe('All assigned branches');
  });
});

describe('canCreateBranch', () => {
  it('allows owner (branch manage/org) and admin (branch create/org)', () => {
    expect(canCreateBranch(SYSTEM_ROLES.OWNER)).toBe(true);
    expect(canCreateBranch(SYSTEM_ROLES.ADMIN)).toBe(true);
  });

  it('denies manager/staff/viewer who only hold branch-scoped branch perms', () => {
    expect(canCreateBranch(SYSTEM_ROLES.MANAGER)).toBe(false);
    expect(canCreateBranch(SYSTEM_ROLES.STAFF)).toBe(false);
    expect(canCreateBranch(SYSTEM_ROLES.VIEWER)).toBe(false);
  });

  it('denies unknown or nullish roles', () => {
    expect(canCreateBranch('receptionist')).toBe(false);
    expect(canCreateBranch(null)).toBe(false);
    expect(canCreateBranch(undefined)).toBe(false);
  });
});
