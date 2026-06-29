import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyCatalogController } from './loyalty-catalog.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyCatalogController', () => {
  const catalog = {
    listRewards: vi.fn(),
    createReward: vi.fn(),
    updateReward: vi.fn(),
    redeemReward: vi.fn(),
    listCoupons: vi.fn(),
    createCoupon: vi.fn(),
    validateCoupon: vi.fn(),
  };
  let controller: LoyaltyCatalogController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyCatalogController(catalog as never);
  });

  it('lists active rewards by default', async () => {
    catalog.listRewards.mockResolvedValue([]);
    await controller.listRewards(USER);
    expect(catalog.listRewards).toHaveBeenCalledWith(ORG_ID, true);
  });

  it('lists all rewards when all=true query', async () => {
    await controller.listRewards(USER, 'true');
    expect(catalog.listRewards).toHaveBeenCalledWith(ORG_ID, false);
  });

  it('creates reward with parsed validity dates', async () => {
    catalog.createReward.mockResolvedValue({ id: 'r1' });
    const body = {
      name: 'Free coffee',
      pointsCost: 100,
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2026-12-31T23:59:59.000Z',
    };
    await controller.createReward(USER, body as never);
    expect(catalog.createReward).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        name: 'Free coffee',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T23:59:59.000Z'),
      }),
    );
  });

  it('redeems reward for customer', async () => {
    const customerId = '00000000-0000-0000-0000-000000000001';
    const rewardId = '00000000-0000-0000-0000-000000000002';
    catalog.redeemReward.mockResolvedValue({ ok: true });
    await controller.redeemReward(USER, { customerId, rewardId } as never);
    expect(catalog.redeemReward).toHaveBeenCalledWith(ORG_ID, customerId, rewardId);
  });

  it('uppercases coupon code on create', async () => {
    catalog.createCoupon.mockResolvedValue({ id: 'c1' });
    await controller.createCoupon(USER, { code: 'save10', discountType: 'PERCENT' } as never);
    expect(catalog.createCoupon).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ code: 'SAVE10' }),
    );
  });

  it('validates coupon for account', async () => {
    catalog.validateCoupon.mockResolvedValue({ valid: true });
    await controller.validateCoupon(USER, { code: 'SAVE10', accountId: 'acc-1' } as never);
    expect(catalog.validateCoupon).toHaveBeenCalledWith(ORG_ID, 'SAVE10', 'acc-1');
  });
});
