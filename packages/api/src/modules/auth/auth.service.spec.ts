import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$hashedpasswordhashvalue000000000000000000000000000'),
}));

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  passwordReset: {
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  account: {
    update: vi.fn().mockResolvedValue({}),
  },
  session: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  $transaction: vi.fn(),
};

const mockJwtService = { signAsync: vi.fn(), verify: vi.fn(), verifyAsync: vi.fn() };
const mockConfigService = { get: vi.fn() };
const mockNotificationService = { send: vi.fn().mockResolvedValue(undefined) };
const mockRequestContext = { getContext: vi.fn(), getRequestId: vi.fn() };
const mockPlatformAudit = {};
const mockAudit = {
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
};
const mockRedisService = { set: vi.fn(), get: vi.fn() };

describe('AuthService.resetPassword', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    mockPrisma.passwordReset.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
    service = new AuthService(
      mockPrisma as never,
      mockJwtService as never,
      mockConfigService as never,
      mockNotificationService as never,
      mockRequestContext as never,
      mockPlatformAudit as never,
      mockAudit as never,
      mockRedisService as never,
    );
  });

  it('throws when reset token is unknown or used', async () => {
    mockPrisma.passwordReset.findFirst.mockResolvedValue(null);
    await expect(service.resetPassword('bad-token', 'ValidPass1a')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.resetPassword('bad-token', 'ValidPass1a')).rejects.toThrow(
      /Invalid or expired/,
    );
  });

  it('throws when account row is missing', async () => {
    mockPrisma.passwordReset.findFirst.mockResolvedValue({
      id: 'pr-1',
      userId: 'missing-user',
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.resetPassword('good-token', 'ValidPass1a')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('clears two-factor fields and revokes sessions in the same transaction', async () => {
    mockPrisma.passwordReset.findFirst.mockResolvedValue({
      id: 'pr-1',
      userId: 'user-1',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      orgId: 'org-uuid',
      accountId: null,
      twoFactorEnabled: true,
      adminTwoFactorEnabled: false,
    });

    const result = await service.resetPassword('plain-token', 'ValidPass1a');

    expect(result).toMatchObject({
      message: 'Password reset successfully',
      twoFactorCleared: true,
    });

    expect(mockPrisma.withBypassRls).toHaveBeenCalled();
    expect(mockPrisma.passwordReset.update).toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalled();
    expect(mockPrisma.session.updateMany).toHaveBeenCalled();
    expect(mockAudit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-uuid',
        userId: 'user-1',
        action: 'auth.password_reset',
        metadata: { twoFactorCleared: true },
      }),
    );
    expect(mockAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-uuid',
        userId: 'user-1',
        action: 'password_reset',
        tableName: 'users',
        recordId: 'user-1',
      }),
    );
  });

  it('returns twoFactorCleared false when 2FA was not enabled', async () => {
    mockPrisma.passwordReset.findFirst.mockResolvedValue({
      id: 'pr-2',
      userId: 'user-2',
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      orgId: 'org-2',
      accountId: null,
      twoFactorEnabled: false,
      adminTwoFactorEnabled: false,
    });

    const result = await service.resetPassword('plain-token', 'AnotherPass1b');

    expect(result.twoFactorCleared).toBe(false);
    expect(mockAudit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { twoFactorCleared: false },
      }),
    );
  });
});
