import { describe, it, expect, vi } from 'vitest';
import {
  loadAdminTwoFactorMemberships,
  syncAdminTwoFactorToMemberships,
} from './admin-two-factor-account.util';
import { Prisma } from '@prisma/client';

const mockTx = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
};

describe('admin-two-factor-account.util', () => {
  it('treats admin 2FA as enabled when another org membership has it enabled', async () => {
    mockTx.user.findUnique.mockResolvedValue({
      id: 'user-internal',
      orgId: 'org-internal',
      email: 'ops@example.com',
      accountId: 'acct-1',
      adminTwoFactorEnabled: false,
      adminTwoFactorSecret: null,
      adminTwoFactorBackupHashes: null,
    });
    mockTx.user.findMany.mockResolvedValue([
      {
        id: 'user-internal',
        orgId: 'org-internal',
        email: 'ops@example.com',
        adminTwoFactorEnabled: false,
        adminTwoFactorSecret: null,
        adminTwoFactorBackupHashes: null,
      },
      {
        id: 'user-demo',
        orgId: 'org-demo',
        email: 'ops@example.com',
        adminTwoFactorEnabled: true,
        adminTwoFactorSecret: 'SECRET123',
        adminTwoFactorBackupHashes: ['hash-1'],
      },
    ]);

    const resolved = await loadAdminTwoFactorMemberships(mockTx as any, 'user-internal');

    expect(resolved?.enabled).toBe(true);
    expect(resolved?.secret).toBe('SECRET123');
    expect(resolved?.enrollmentPending).toBe(false);
  });

  it('surfaces pending enrollment from any org membership', async () => {
    mockTx.user.findUnique.mockResolvedValue({
      id: 'user-demo',
      orgId: 'org-demo',
      email: 'ops@example.com',
      accountId: 'acct-1',
      adminTwoFactorEnabled: false,
      adminTwoFactorSecret: null,
      adminTwoFactorBackupHashes: null,
    });
    mockTx.user.findMany.mockResolvedValue([
      {
        id: 'user-demo',
        orgId: 'org-demo',
        email: 'ops@example.com',
        adminTwoFactorEnabled: false,
        adminTwoFactorSecret: null,
        adminTwoFactorBackupHashes: null,
      },
      {
        id: 'user-internal',
        orgId: 'org-internal',
        email: 'ops@example.com',
        adminTwoFactorEnabled: false,
        adminTwoFactorSecret: 'PENDINGSECRET',
        adminTwoFactorBackupHashes: null,
      },
    ]);

    const resolved = await loadAdminTwoFactorMemberships(mockTx as any, 'user-demo');

    expect(resolved?.enabled).toBe(false);
    expect(resolved?.enrollmentPending).toBe(true);
    expect(resolved?.secret).toBe('PENDINGSECRET');
  });

  it('syncs admin 2FA writes across all account memberships', async () => {
    const memberships = [
      {
        id: 'user-a',
        orgId: 'org-a',
        email: 'ops@example.com',
        adminTwoFactorEnabled: false,
        adminTwoFactorSecret: null,
        adminTwoFactorBackupHashes: null,
      },
      {
        id: 'user-b',
        orgId: 'org-b',
        email: 'ops@example.com',
        adminTwoFactorEnabled: false,
        adminTwoFactorSecret: null,
        adminTwoFactorBackupHashes: null,
      },
    ];

    await syncAdminTwoFactorToMemberships(mockTx as any, memberships, {
      adminTwoFactorSecret: 'NEWSECRET',
      adminTwoFactorEnabled: false,
      adminTwoFactorBackupHashes: Prisma.DbNull,
    });

    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(mockTx.user.updateMany).toHaveBeenCalledTimes(2);
    expect(mockTx.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-a', 'user-b'] }, orgId: 'org-a' },
      data: {
        adminTwoFactorSecret: 'NEWSECRET',
        adminTwoFactorEnabled: false,
        adminTwoFactorBackupHashes: Prisma.DbNull,
      },
    });
  });
});
