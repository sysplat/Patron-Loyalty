import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { SYSTEM_ROLES } from '@queueplatform/shared';

describe('AuthService forgotPassword', () => {
  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
    user: { findFirst: vi.fn() },
    roleAssignment: { findFirst: vi.fn() },
    passwordReset: { updateMany: vi.fn(), create: vi.fn() },
  };

  const mockConfig = {
    get: vi
      .fn()
      .mockImplementation((key: string) =>
        key === 'app.appUrl' ? 'https://app.example.com' : undefined,
      ),
  };

  const mockNotification = { send: vi.fn().mockResolvedValue(undefined) };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockPrisma as any,
      {} as any,
      mockConfig as any,
      mockNotification as any,
      {} as any,
      {} as any,
      { logActivity: vi.fn(), logAudit: vi.fn() } as any,
      {} as any, // redis
    );
  });

  async function arrangeOwner(
    opts: Partial<{ suspended: boolean; orgSuspended: boolean; verified: boolean }> = {},
  ) {
    const suspended = opts.suspended ?? false;
    const orgSuspended = opts.orgSuspended ?? false;
    const verified = opts.verified ?? true;
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      orgId: 'o1',
      email: 'owner@test.com',
      firstName: 'O',
      status: suspended ? 'suspended' : 'active',
      emailVerified: verified,
      organization: { status: orgSuspended ? 'suspended' : 'active' },
    });
    mockPrisma.roleAssignment.findFirst.mockResolvedValue({ id: 'ra1' });
    mockPrisma.passwordReset.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordReset.create.mockResolvedValue({ id: 'pr1' });
  }

  it('creates reset and queues email only for verified active organization owner', async () => {
    await arrangeOwner();
    await service.forgotPassword('OWNER@Test.com');

    expect(mockPrisma.roleAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        role: { orgId: 'o1', name: SYSTEM_ROLES.OWNER },
      },
      select: { id: true },
    });
    expect(mockPrisma.passwordReset.create).toHaveBeenCalledTimes(1);
    expect(mockNotification.send).toHaveBeenCalledTimes(1);
  });

  it('does nothing for unknown email but returns generic message', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await service.forgotPassword('nope@test.com');

    expect(res.message).toMatch(/sent/i);
    expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    expect(mockNotification.send).not.toHaveBeenCalled();
  });

  it('does not send for non-owner (same outward message)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u2',
      orgId: 'o1',
      email: 'staff@test.com',
      firstName: 'S',
      status: 'active',
      emailVerified: true,
      organization: { status: 'active' },
    });
    mockPrisma.roleAssignment.findFirst.mockResolvedValue(null);

    const res = await service.forgotPassword('staff@test.com');

    expect(res.message).toMatch(/sent/i);
    expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    expect(mockNotification.send).not.toHaveBeenCalled();
  });

  it('does not send when email not verified', async () => {
    await arrangeOwner({ verified: false });
    await service.forgotPassword('owner@test.com');

    expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    expect(mockNotification.send).not.toHaveBeenCalled();
  });

  it('does not send when organization is suspended', async () => {
    await arrangeOwner({ orgSuspended: true });
    await service.forgotPassword('owner@test.com');

    expect(mockPrisma.passwordReset.create).not.toHaveBeenCalled();
    expect(mockNotification.send).not.toHaveBeenCalled();
  });
});
