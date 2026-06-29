import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyReferralsController } from './loyalty-referrals.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyReferralsController', () => {
  const referrals = {
    applyReferral: vi.fn(),
    listReferrals: vi.fn(),
    getReferralStats: vi.fn(),
  };
  let controller: LoyaltyReferralsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyReferralsController(referrals as never);
  });

  it('applies referral code for customer', async () => {
    referrals.applyReferral.mockResolvedValue({ ok: true });
    await controller.applyReferral(USER, {
      referralCode: 'FRIEND10',
      customerId: CUSTOMER_ID,
    } as never);
    expect(referrals.applyReferral).toHaveBeenCalledWith(ORG_ID, 'FRIEND10', CUSTOMER_ID);
  });

  it('lists referrals', async () => {
    referrals.listReferrals.mockResolvedValue([]);
    await controller.listReferrals(USER);
    expect(referrals.listReferrals).toHaveBeenCalledWith(ORG_ID);
  });

  it('returns referral stats', async () => {
    referrals.getReferralStats.mockResolvedValue({ total: 5 });
    await controller.referralStats(USER);
    expect(referrals.getReferralStats).toHaveBeenCalledWith(ORG_ID);
  });
});
