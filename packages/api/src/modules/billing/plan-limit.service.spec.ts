import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PlanLimitService } from './plan-limit.service';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  subscription: {
    findFirst: vi.fn(),
  },
};

/** Default: cache miss so tests exercise the DB path unchanged. */
const mockRedis = {
  getJson: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
};

const mockSmsCredits = {
  getSmsCreditsAllowance: vi
    .fn()
    .mockResolvedValue({ planBase: 300, purchasedBonus: 0, effectiveLimit: 300 }),
};

function makeService() {
  return new PlanLimitService(mockPrisma as any, mockRedis as any, mockSmsCredits as any);
}

describe('PlanLimitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default: cache miss so tests exercise the DB path
    mockRedis.getJson.mockResolvedValue(null);
  });

  // ─── getLimits ───────────────────────────────────────────────────────────

  describe('getLimits', () => {
    it('returns plan limits when an active subscription exists', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { maxBranches: 3, hasSmsNotifications: true } },
      });

      const limits = await makeService().getLimits('org-1');
      expect(limits).toEqual({ maxBranches: 3, hasSmsNotifications: true });
    });

    it('returns empty object when no active subscription is found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      const limits = await makeService().getLimits('org-1');
      expect(limits).toEqual({});
    });

    it('queries only active or trialing subscriptions', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      await makeService().getLimits('org-1');
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: 'org-1', status: { in: ['active', 'trialing'] } },
        }),
      );
    });
  });

  // ─── checkLimit ──────────────────────────────────────────────────────────

  describe('checkLimit', () => {
    it('returns allowed=true when current is below plan limit', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { maxBranches: 3 } },
      });

      const result = await makeService().checkLimit('org-1', 'maxBranches', 1);

      expect(result.allowed).toBe(true);
      expect(result.limitReached).toBe(false);
      expect(result.limit).toBe(3);
      expect(result.current).toBe(1);
      expect(result.feature).toBe('maxBranches');
    });

    it('returns limitReached=true when current equals plan limit', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { maxBranches: 1 } },
      });

      const result = await makeService().checkLimit('org-1', 'maxBranches', 1);

      expect(result.allowed).toBe(false);
      expect(result.limitReached).toBe(true);
    });

    it('returns limitReached=true when current exceeds plan limit', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { maxBranches: 1 } },
      });

      const result = await makeService().checkLimit('org-1', 'maxBranches', 5);
      expect(result.limitReached).toBe(true);
    });

    it('returns limit=-1 and allowed=true when no subscription exists (permissive default)', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const result = await makeService().checkLimit('org-1', 'maxBranches', 99);

      expect(result.allowed).toBe(true);
      expect(result.limitReached).toBe(false);
      expect(result.limit).toBe(-1);
    });

    it('returns limit=-1 when feature key is missing from plan limits', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: {} },
      });

      const result = await makeService().checkLimit('org-1', 'maxDevices', 10);
      expect(result.limit).toBe(-1);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── requireFeature ──────────────────────────────────────────────────────

  describe('requireFeature', () => {
    it('does not throw when the feature is enabled in the plan', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { hasSmsNotifications: true } },
      });

      await expect(
        makeService().requireFeature('org-1', 'hasSmsNotifications'),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when the feature is disabled (false)', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { hasSmsNotifications: false } },
      });

      await expect(makeService().requireFeature('org-1', 'hasSmsNotifications')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when no subscription exists (feature absent)', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(makeService().requireFeature('org-1', 'hasSmsNotifications')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException with a custom error message when provided', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { hasSmsNotifications: false } },
      });

      await expect(
        makeService().requireFeature('org-1', 'hasSmsNotifications', 'Custom upgrade message'),
      ).rejects.toThrow('Custom upgrade message');
    });

    it('throws ForbiddenException with the default message when no custom message is given', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { hasSmsNotifications: false } },
      });

      await expect(makeService().requireFeature('org-1', 'hasSmsNotifications')).rejects.toThrow(
        'Your current plan does not include access to this feature',
      );
    });
  });

  // ─── Redis caching ───────────────────────────────────────────────────────

  describe('getLimits — Redis caching', () => {
    it('returns cached limits without hitting the database', async () => {
      mockRedis.getJson.mockResolvedValue({ maxBranches: 5 });

      const limits = await makeService().getLimits('org-cache');

      expect(limits).toEqual({ maxBranches: 5 });
      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
    });

    it('writes limits to Redis after a DB miss', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        plan: { limits: { maxBranches: 3 } },
      });

      await makeService().getLimits('org-1');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'plan:limits:org-1',
        JSON.stringify({ maxBranches: 3 }),
        300,
      );
    });
  });

  describe('invalidateLimitsCache', () => {
    it('deletes the Redis key for the given org', async () => {
      await makeService().invalidateLimitsCache('org-1');
      expect(mockRedis.del).toHaveBeenCalledWith('plan:limits:org-1');
    });
  });
});
