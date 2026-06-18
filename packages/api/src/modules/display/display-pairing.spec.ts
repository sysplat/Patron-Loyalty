import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisplayService } from './display.service';

/**
 * OTP pairing must validate branch ownership at code generation and confirmation
 * so devices cannot be bound to mismatched org/branch pairs.
 */
describe('DisplayService — pairing', () => {
  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
    branch: { findFirst: vi.fn() },
    displayDevice: { count: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    roleAssignment: { findMany: vi.fn() },
  };

  const mockRedis = {
    setJson: vi.fn().mockResolvedValue(undefined),
    getJson: vi.fn(),
    del: vi.fn().mockResolvedValue(undefined),
  };

  const mockConfig = {
    get: vi.fn((key: string) => {
      if (key === 'app.displayCodeExpiryMinutes') return 15;
      return undefined;
    }),
  };

  const mockJwtService = { sign: vi.fn().mockReturnValue('signed-jwt') };
  const mockPlanLimits = {
    checkLimit: vi.fn().mockResolvedValue({ allowed: true }),
  };

  let service: DisplayService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DisplayService(
      mockPrisma as any,
      mockRedis as any,
      mockConfig as any,
      mockJwtService as any,
      mockPlanLimits as any,
    );
  });

  describe('requestReversePairingCode', () => {
    it('stores reverse pairing payload and session', async () => {
      const result = await service.requestReversePairingCode();

      expect(result.code).toHaveLength(6);
      expect(result.sessionId).toBeTruthy();
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        expect.stringMatching(/^pairing:[A-Z2-9]{6}$/),
        expect.objectContaining({ mode: 'reverse', status: 'pending' }),
        15 * 60,
      );
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        expect.stringMatching(/^pairing:session:/),
        expect.objectContaining({ status: 'pending' }),
        15 * 60,
      );
    });
  });

  describe('linkScreenForPrincipal', () => {
    it('rejects non-reverse or missing codes', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        { branchId: null, role: { name: 'owner' } },
      ]);
      mockRedis.getJson.mockResolvedValue(null);
      await expect(
        service.linkScreenForPrincipal('org-1', 'user-1', { code: 'ABC123', branchId: 'branch-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects branch outside assigned scope for branch-scoped roles', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        { branchId: 'branch-1', role: { name: 'staff' } },
      ]);
      await expect(
        service.linkScreenForPrincipal('org-1', 'user-1', {
          code: 'ABC123',
          branchId: 'branch-other',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRedis.getJson).not.toHaveBeenCalled();
    });

    it('creates device when principal may access the branch', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        { branchId: 'branch-1', role: { name: 'manager' } },
      ]);
      mockRedis.getJson.mockResolvedValue({
        mode: 'reverse',
        sessionId: 'session-1',
        status: 'pending',
      });
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-1', name: 'Main' });
      mockPrisma.displayDevice.count.mockResolvedValue(0);
      mockPrisma.displayDevice.create.mockResolvedValue({
        id: 'device-1',
        name: 'Display ABC123',
        branchId: 'branch-1',
        orgId: 'org-1',
      });

      const result = await service.linkScreenForPrincipal('org-1', 'user-1', {
        code: 'abc123',
        branchId: 'branch-1',
      });

      expect(result.device.id).toBe('device-1');
      expect(mockPrisma.displayDevice.create).toHaveBeenCalled();
    });

    it('allows owner to link any branch in the org', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        { branchId: null, role: { name: 'owner' } },
      ]);
      mockRedis.getJson.mockResolvedValue({
        mode: 'reverse',
        sessionId: 'session-2',
        status: 'pending',
      });
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-2', name: 'East' });
      mockPrisma.displayDevice.count.mockResolvedValue(0);
      mockPrisma.displayDevice.create.mockResolvedValue({
        id: 'device-2',
        name: 'Display XYZABC',
        branchId: 'branch-2',
        orgId: 'org-1',
      });

      const result = await service.linkScreenForPrincipal('org-1', 'user-owner', {
        code: 'XYZABC',
        branchId: 'branch-2',
      });

      expect(result.device.id).toBe('device-2');
    });
  });

  describe('claimReversePairing', () => {
    it('returns credentials when session is linked', async () => {
      mockRedis.getJson.mockResolvedValue({
        code: 'ABC123',
        status: 'linked',
        deviceId: 'device-1',
        apiKey: 'dsp_testkey',
        sessionToken: 'signed-jwt',
      });
      mockPrisma.displayDevice.update.mockResolvedValue({
        id: 'device-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        status: 'online',
      });

      const result = await service.claimReversePairing('session-1', 'fp');

      expect(result.apiKey).toBe('dsp_testkey');
      expect(result.sessionToken).toBe('signed-jwt');
      expect(result.device.id).toBe('device-1');
      expect(mockRedis.del).toHaveBeenCalledWith('pairing:session:session-1');
    });
  });
});
