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

  it('skips side effects when burn is idempotent', async () => {
    accounts.burnPoints.mockResolvedValue({
      finalAccount: { id: 'acc-1', pointsBalance: 900 },
      idempotent: true,
      type: 'BURN',
      points: 100,
      delta: -100,
      customerId: 'cust-1',
    });

    await service.redeemReward('org-1', 'cust-1', 'reward-1');

    expect(accounts.dispatchApplyPointsSideEffects).not.toHaveBeenCalled();
    expect(loyaltyWebhook.dispatch).toHaveBeenCalled();
  });

  it('rejects when reward is not found', async () => {
    rewardFindFirst.mockResolvedValue(null);

    await expect(service.redeemReward('org-1', 'cust-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects reward before validFrom', async () => {
    rewardFindFirst.mockResolvedValue({
      id: 'reward-1',
      orgId: 'org-1',
      name: 'Future perk',
      pointsCost: 50,
      stock: null,
      active: true,
      validFrom: new Date('2099-01-01'),
      validUntil: null,
    });

    await expect(service.redeemReward('org-1', 'cust-1', 'reward-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects expired reward', async () => {
    rewardFindFirst.mockResolvedValue({
      id: 'reward-1',
      orgId: 'org-1',
      name: 'Old perk',
      pointsCost: 50,
      stock: null,
      active: true,
      validFrom: null,
      validUntil: new Date('2000-01-01'),
    });

    await expect(service.redeemReward('org-1', 'cust-1', 'reward-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('LoyaltyCatalogService validateCoupon', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = {};
  const loyaltyWebhook = { dispatch: vi.fn() };
  const couponFindFirst = vi.fn();
  const accountFindFirst = vi.fn();
  let service: LoyaltyCatalogService;

  const baseCoupon = {
    id: 'coupon-1',
    orgId: 'org-1',
    code: 'SAVE10',
    active: true,
    validFrom: null,
    validUntil: null,
    maxUses: null,
    usedCount: 0,
    tierSlugs: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    couponFindFirst.mockResolvedValue(baseCoupon);
    accountFindFirst.mockResolvedValue({ id: 'acc-1', tier: { slug: 'gold' } });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({ loyaltyCoupon: { findFirst: couponFindFirst } });
      }
      return fn({ loyaltyAccount: { findFirst: accountFindFirst } });
    });
    service = new LoyaltyCatalogService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
      loyaltyWebhook as never,
    );
  });

  it('returns valid coupon without account tier check', async () => {
    const result = await service.validateCoupon('org-1', 'save10');
    expect(result).toEqual({ valid: true, coupon: baseCoupon });
    expect(accountFindFirst).not.toHaveBeenCalled();
  });

  it('loads account when accountId provided', async () => {
    await service.validateCoupon('org-1', 'save10', 'acc-1');
    expect(accountFindFirst).toHaveBeenCalled();
  });

  it('rejects expired coupon', async () => {
    couponFindFirst.mockResolvedValue({
      ...baseCoupon,
      validUntil: new Date('2000-01-01'),
    });

    await expect(service.validateCoupon('org-1', 'save10')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects coupon for wrong tier', async () => {
    couponFindFirst.mockResolvedValue({
      ...baseCoupon,
      tierSlugs: ['platinum'],
    });

    await expect(service.validateCoupon('org-1', 'save10', 'acc-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when coupon missing', async () => {
    couponFindFirst.mockResolvedValue(null);

    await expect(service.validateCoupon('org-1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects coupon before validFrom', async () => {
    couponFindFirst.mockResolvedValue({
      ...baseCoupon,
      validFrom: new Date('2099-01-01'),
    });

    await expect(service.validateCoupon('org-1', 'save10')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects coupon when usage limit reached', async () => {
    couponFindFirst.mockResolvedValue({
      ...baseCoupon,
      maxUses: 5,
      usedCount: 5,
    });

    await expect(service.validateCoupon('org-1', 'save10')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('LoyaltyCatalogService catalog CRUD', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = {};
  const loyaltyWebhook = { dispatch: vi.fn() };
  let service: LoyaltyCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyCatalogService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
      loyaltyWebhook as never,
    );
  });

  it('lists active rewards only by default', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'r1' }]);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyReward: { findMany } }),
    );

    const rewards = await service.listRewards('org-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { pointsCost: 'asc' },
    });
    expect(rewards).toEqual([{ id: 'r1' }]);
  });

  it('lists all rewards when activeOnly is false', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyReward: { findMany } }),
    );

    await service.listRewards('org-1', false);

    expect(findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { pointsCost: 'asc' },
    });
  });

  it('creates and updates rewards', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'r-new' });
    const update = vi.fn().mockResolvedValue({ id: 'r-1', name: 'Updated' });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({ loyaltyReward: { create } });
      }
      return fn({ loyaltyReward: { update } });
    });

    const created = await service.createReward('org-1', {
      name: 'Latte',
      type: 'item',
      pointsCost: 100,
    });
    const updated = await service.updateReward('org-1', 'r-1', { name: 'Updated' });

    expect(created).toEqual({ id: 'r-new' });
    expect(updated).toEqual({ id: 'r-1', name: 'Updated' });
  });

  it('lists and creates coupons', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'c1' }]);
    const create = vi.fn().mockResolvedValue({ id: 'c-new' });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({ loyaltyCoupon: { findMany } });
      }
      return fn({ loyaltyCoupon: { create } });
    });

    const coupons = await service.listCoupons('org-1');
    const created = await service.createCoupon('org-1', { code: 'WELCOME', active: true });

    expect(coupons).toEqual([{ id: 'c1' }]);
    expect(created).toEqual({ id: 'c-new' });
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

  it('throws when coupon is missing', async () => {
    couponFindFirst.mockResolvedValue(null);

    await expect(service.redeemCoupon('org-1', 'nope', 'acc-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
