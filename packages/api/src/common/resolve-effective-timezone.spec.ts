import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveBranchIanaZone, resolveEffectiveIanaZone } from './resolve-effective-timezone';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  branch: { findFirst: vi.fn() },
  queue: { findFirst: vi.fn() },
  organization: { findUnique: vi.fn() },
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
};

describe('resolve-effective-timezone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({ timezone: 'America/New_York' });
  });

  describe('resolveBranchIanaZone', () => {
    it('returns branch timezone when set', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'America/Toronto' });

      const tz = await resolveBranchIanaZone(
        mockPrisma as never,
        'org-1',
        'branch-1',
        mockRedis as never,
      );

      expect(tz).toBe('America/Toronto');
      expect(mockPrisma.branch.findFirst).toHaveBeenCalledWith({
        where: { id: 'branch-1', orgId: 'org-1' },
        select: { timezone: true },
      });
    });

    it('falls back to organization timezone when branch timezone is empty', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ timezone: '' });

      const tz = await resolveBranchIanaZone(mockPrisma as never, 'org-1', 'branch-1');

      expect(tz).toBe('America/New_York');
    });

    it('normalizes invalid branch timezone to UTC', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'Not/A/Zone' });

      const tz = await resolveBranchIanaZone(mockPrisma as never, 'org-1', 'branch-1');

      expect(tz).toBe('UTC');
    });
  });

  describe('resolveEffectiveIanaZone', () => {
    it('uses branchId directly when provided', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'Asia/Dubai' });

      const tz = await resolveEffectiveIanaZone(mockPrisma as never, 'org-1', {
        branchId: 'branch-1',
      });

      expect(tz).toBe('Asia/Dubai');
      expect(mockPrisma.queue.findFirst).not.toHaveBeenCalled();
    });

    it('resolves queueId to branch timezone', async () => {
      mockPrisma.queue.findFirst.mockResolvedValue({ branchId: 'branch-2' });
      mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'America/Vancouver' });

      const tz = await resolveEffectiveIanaZone(mockPrisma as never, 'org-1', {
        queueId: 'queue-1',
      });

      expect(tz).toBe('America/Vancouver');
      expect(mockPrisma.queue.findFirst).toHaveBeenCalledWith({
        where: { id: 'queue-1', orgId: 'org-1' },
        select: { branchId: true },
      });
    });

    it('falls back to org timezone when no branch or queue context', async () => {
      const tz = await resolveEffectiveIanaZone(mockPrisma as never, 'org-1', {});

      expect(tz).toBe('America/New_York');
      expect(mockPrisma.branch.findFirst).not.toHaveBeenCalled();
    });
  });
});
