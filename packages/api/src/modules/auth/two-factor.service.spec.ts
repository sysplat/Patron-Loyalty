import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { TwoFactorService } from './two-factor.service';
import { generateTotpSecret } from './two-factor.util';

vi.mock('bcrypt');

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
};

function mockAdminMembership(overrides: {
  id?: string;
  orgId?: string;
  email?: string;
  accountId?: string | null;
  adminTwoFactorEnabled?: boolean;
  adminTwoFactorSecret?: string | null;
  adminTwoFactorBackupHashes?: unknown;
}) {
  const membership = {
    id: overrides.id ?? 'user-1',
    orgId: overrides.orgId ?? 'org-1',
    email: overrides.email ?? 'ops@example.com',
    adminTwoFactorEnabled: overrides.adminTwoFactorEnabled ?? false,
    adminTwoFactorSecret: overrides.adminTwoFactorSecret ?? null,
    adminTwoFactorBackupHashes: overrides.adminTwoFactorBackupHashes ?? null,
  };
  mockPrisma.user.findUnique.mockResolvedValue({
    ...membership,
    accountId: overrides.accountId ?? null,
  });
  mockPrisma.user.findMany.mockResolvedValue([membership]);
}

describe('TwoFactorService', () => {
  let service: TwoFactorService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TwoFactorService(mockPrisma as any);
  });

  describe('cancelSetup', () => {
    it('clears pending secret when 2FA is not enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        orgId: 'org-1',
        twoFactorEnabled: false,
        twoFactorSecret: 'ABCD1234',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const r = await service.cancelSetup('user-1');

      expect(r.cancelled).toBe(true);
      expect(mockPrisma.withBypassRls).toHaveBeenCalledWith(expect.any(Function), {
        orgId: 'org-1',
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          twoFactorSecret: null,
        }),
      });
    });

    it('returns cancelled when there is no pending secret', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });

      const r = await service.cancelSetup('user-1');

      expect(r.cancelled).toBe(true);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('clears pending admin secret when admin 2FA is not enabled', async () => {
      mockAdminMembership({
        adminTwoFactorEnabled: false,
        adminTwoFactorSecret: 'ABCD1234',
      });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const r = await service.cancelSetup('user-1', 'admin_dashboard');

      expect(r.cancelled).toBe(true);
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1'] }, orgId: 'org-1' },
        data: expect.objectContaining({
          adminTwoFactorSecret: null,
        }),
      });
    });

    it('throws when org 2FA is already enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        twoFactorEnabled: true,
        twoFactorSecret: 'sec',
      });

      await expect(service.cancelSetup('user-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when admin 2FA is already enabled', async () => {
      mockAdminMembership({
        adminTwoFactorEnabled: true,
        adminTwoFactorSecret: 'sec',
      });

      await expect(service.cancelSetup('user-1', 'admin_dashboard')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('regenerateBackupCodes (admin_dashboard)', () => {
    it('updates admin backup hashes when password and TOTP are valid', async () => {
      const secret = generateTotpSecret();
      const token = authenticator.generate(secret);
      mockAdminMembership({
        adminTwoFactorEnabled: true,
        adminTwoFactorSecret: secret,
      });
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          orgId: 'org-1',
          email: 'ops@example.com',
          accountId: null,
          adminTwoFactorEnabled: true,
          adminTwoFactorSecret: secret,
          adminTwoFactorBackupHashes: null,
        })
        .mockResolvedValueOnce({ passwordHash: 'hash' });
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          orgId: 'org-1',
          email: 'ops@example.com',
          adminTwoFactorEnabled: true,
          adminTwoFactorSecret: secret,
          adminTwoFactorBackupHashes: null,
        },
      ]);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const r = await service.regenerateBackupCodes('user-1', 'password', token, 'admin_dashboard');

      expect(r.backupCodes).toHaveLength(8);
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1'] }, orgId: 'org-1' },
        data: expect.objectContaining({
          adminTwoFactorBackupHashes: expect.any(Array),
        }),
      });
    });
  });

  describe('regenerateBackupCodes', () => {
    it('throws when password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        passwordHash: 'hash',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.regenerateBackupCodes('user-1', 'wrong', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('throws when TOTP is wrong', async () => {
      const secret = generateTotpSecret();
      mockPrisma.user.findUnique.mockResolvedValue({
        passwordHash: 'hash',
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(service.regenerateBackupCodes('user-1', 'ok', '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('replaces backup hashes and returns new codes when password and TOTP are valid', async () => {
      const secret = generateTotpSecret();
      const token = authenticator.generate(secret);
      mockPrisma.user.findUnique.mockResolvedValue({
        orgId: 'org-1',
        passwordHash: 'hash',
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockPrisma.user.update.mockResolvedValue({});

      const r = await service.regenerateBackupCodes('user-1', 'password', token);

      expect(r.backupCodes).toHaveLength(8);
      expect(new Set(r.backupCodes).size).toBe(8);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          twoFactorBackupHashes: expect.any(Array),
        }),
      });
    });
  });
});
