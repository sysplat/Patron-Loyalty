import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLES } from '@queueplatform/shared';
import { pickPrimaryRole } from './tenant-users-panel';

describe('pickPrimaryRole', () => {
  it('returns full when user has no roles', () => {
    expect(pickPrimaryRole([])).toBe('full');
  });

  it('prefers owner over other roles', () => {
    expect(
      pickPrimaryRole([
        { name: SYSTEM_ROLES.STAFF, branchName: 'Main' },
        { name: SYSTEM_ROLES.OWNER, branchName: null },
      ]),
    ).toBe(SYSTEM_ROLES.OWNER);
  });

  it('returns highest known role when owner is absent', () => {
    expect(
      pickPrimaryRole([
        { name: SYSTEM_ROLES.VIEWER, branchName: 'A' },
        { name: SYSTEM_ROLES.MANAGER, branchName: 'B' },
      ]),
    ).toBe(SYSTEM_ROLES.MANAGER);
  });
});
