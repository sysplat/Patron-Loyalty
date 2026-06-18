import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSmsCreditsAllowance } from '@queueplatform/shared';
import { SmsCreditPurchaseService } from './sms-credit-purchase.service';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  subscription: { findFirst: vi.fn() },
  smsCreditPurchase: {
    aggregate: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const redisIncrby = vi.fn().mockResolvedValue(500);
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  getClient: vi.fn(() => ({
    incrby: redisIncrby,
  })),
};

describe('SmsCreditPurchaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.smsCreditPurchase.aggregate.mockResolvedValue({ _sum: { messages: 0 } });
  });

  it('computeSmsCreditsAllowance adds plan base and purchased bonus', () => {
    expect(computeSmsCreditsAllowance(300, 500)).toEqual({
      planBase: 300,
      purchasedBonus: 500,
      effectiveLimit: 800,
    });
  });

  it('completePurchase is idempotent when already completed', async () => {
    mockPrisma.smsCreditPurchase.findUnique.mockResolvedValue({
      id: 'p1',
      orgId: 'org-1',
      messages: 500,
      status: 'completed',
    });

    const service = new SmsCreditPurchaseService(mockPrisma as any, mockRedis as any);
    const result = await service.completePurchase('cs_test_1');

    expect(result).toEqual({ orgId: 'org-1', messages: 0 });
    expect(mockPrisma.smsCreditPurchase.update).not.toHaveBeenCalled();
  });

  it('completePurchase increments bonus on first completion', async () => {
    mockPrisma.smsCreditPurchase.findUnique.mockResolvedValue({
      id: 'p1',
      orgId: 'org-1',
      messages: 500,
      status: 'pending',
    });
    mockPrisma.smsCreditPurchase.update.mockResolvedValue({});

    const service = new SmsCreditPurchaseService(mockPrisma as any, mockRedis as any);
    const result = await service.completePurchase('cs_test_2');

    expect(result).toEqual({ orgId: 'org-1', messages: 500 });
    expect(mockPrisma.smsCreditPurchase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
    expect(redisIncrby).toHaveBeenCalledWith('sms:credits:bonus:lifetime:org-1', 500);
  });
});
