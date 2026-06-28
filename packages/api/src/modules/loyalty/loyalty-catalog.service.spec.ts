import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LOYALTY_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { LoyaltyCatalogService } from './loyalty-catalog.service';

describe('LoyaltyCatalogService redeemReward', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = {
    getAccountByCustomerId: vi.fn(),
    burnPoints: vi.fn(),
    dispatchApplyPointsSideEffects: vi.fn(),
  };
  const loyaltyWebhook = { dispatch: vi.fn() };

  const rewardFindFirst = vi.fn();
  const rewardUpdateMany = vi.fn();
  const redemptionCreate = vi.fn();

  let service: LoyaltyCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    accounts.getAccountByCustomerId.mockResolvedValue({ id: 'acc-1' });
    rewardFindFirst.mockResolvedValue({
      id: 'reward-1',
      orgId: 'org-1',
      name: 'Free coffee',
      pointsCost: 100,
      stock: 5,
      active: true,
      validFrom: null,
      validUntil: null,
    });
    rewardUpdateMany.mockResolvedValue({ count: 1 });
    accounts.burnPoints.mockResolvedValue({
      finalAccount: { id: 'acc-1', pointsBalance: 900 },
      idempotent: false,
      type: 'BURN',
      points: 100,
      delta: -100,
      customerId: 'cust-1',
    });
    redemptionCreate.mockResolvedValue({
      id: 'red-1',
      pointsSpent: 100,
      reward: { name: 'Free coffee' },
    });

    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyReward: {
          findFirst: rewardFindFirst,
          updateMany: rewardUpdateMany,
        },
        loyaltyRedemption: { create: redemptionCreate },
      }),
    );

    service = new LoyaltyCatalogService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
      loyaltyWebhook as never,
    );
  });

  it('burns points, decrements stock, and creates redemption in one transaction', async () => {
    const result = await service.redeemReward('org-1', 'cust-1', 'reward-1');

    expect(prisma.withTenant).toHaveBeenCalledOnce();
    expect(accounts.burnPoints).toHaveBeenCalledWith(
      'org-1',
      'acc-1',
      100,
      expect.objectContaining({ sourceType: 'reward', sourceId: 'reward-1' }),
      expect.any(Object),
    );
    expect(rewardUpdateMany).toHaveBeenCalledWith({
      where: { id: 'reward-1', orgId: 'org-1', stock: { gt: 0 } },
      data: { stock: { decrement: 1 } },
    });
    expect(redemptionCreate).toHaveBeenCalledOnce();
    expect(accounts.dispatchApplyPointsSideEffects).toHaveBeenCalledOnce();
    expect(loyaltyWebhook.dispatch).toHaveBeenCalledWith(
      'org-1',
      LOYALTY_WEBHOOK_EVENTS.REWARD_REDEEMED,
      expect.objectContaining({ redemptionId: 'red-1' }),
    );
    expect(result.id).toBe('red-1');
  });

  it('rolls back when stock is exhausted (no redemption)', async () => {
    rewardUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.redeemReward('org-1', 'cust-1', 'reward-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(accounts.burnPoints).toHaveBeenCalled();
    expect(redemptionCreate).not.toHaveBeenCalled();
    expect(accounts.dispatchApplyPointsSideEffects).not.toHaveBeenCalled();
  });
});

describe('LoyaltyCatalogService redeemCoupon', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = {};
  const loyaltyWebhook = { dispatch: vi.fn() };

  const couponFindFirst = vi.fn();
  const accountFindFirst = vi.fn();
  const couponUpdateMany = vi.fn();
  const couponRedemptionCreate = vi.fn();

  let service: LoyaltyCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    couponFindFirst.mockResolvedValue({
      id: 'coupon-1',
      orgId: 'org-1',
      code: 'SAVE10',
      active: true,
      validFrom: null,
      validUntil: null,
      maxUses: 1,
      usedCount: 0,
      tierSlugs: [],
    });
    accountFindFirst.mockResolvedValue({ id: 'acc-1', tier: null });
    couponUpdateMany.mockResolvedValue({ count: 1 });
    couponRedemptionCreate.mockResolvedValue({ id: 'cr-1', coupon: { code: 'SAVE10' } });

    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCoupon: {
          findFirst: couponFindFirst,
          updateMany: couponUpdateMany,
        },
        loyaltyAccount: { findFirst: accountFindFirst },
        loyaltyCouponRedemption: { create: couponRedemptionCreate },
      }),
    );

    service = new LoyaltyCatalogService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
      loyaltyWebhook as never,
    );
  });

  it('atomically reserves coupon use before creating redemption', async () => {
    const result = await service.redeemCoupon('org-1', 'save10', 'acc-1');

    expect(couponUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'coupon-1',
        orgId: 'org-1',
        active: true,
        usedCount: { lt: 1 },
      },
      data: { usedCount: { increment: 1 } },
    });
    expect(couponRedemptionCreate).toHaveBeenCalledOnce();
    expect(result.id).toBe('cr-1');
  });

  it('rejects when maxUses is reached under concurrency', async () => {
    couponUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.redeemCoupon('org-1', 'save10', 'acc-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(couponRedemptionCreate).not.toHaveBeenCalled();
  });

  it('throws when account is missing', async () => {
    accountFindFirst.mockResolvedValue(null);

    await expect(service.redeemCoupon('org-1', 'save10', 'acc-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
