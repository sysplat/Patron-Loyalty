import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyPublicController } from './loyalty-public.controller';

describe('LoyaltyPublicController', () => {
  const referrals = { getPublicReferralLanding: vi.fn(), joinViaPublicReferral: vi.fn() };
  const portal = {
    getPortalByReferralCode: vi.fn(),
    redeemReward: vi.fn(),
    getPublicBranches: vi.fn(),
  };
  const patronCrmFeature = { isEnabled: vi.fn() };
  const findFirst = vi.fn();
  const prisma = {
    withBypassRls: vi.fn((fn: (tx: unknown) => unknown) => fn({ loyaltyAccount: { findFirst } })),
  };
  let controller: LoyaltyPublicController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyPublicController(
      referrals as never,
      portal as never,
      prisma as never,
      patronCrmFeature as never,
    );
  });

  it('delegates portal lookup by referral code', async () => {
    portal.getPortalByReferralCode.mockResolvedValue({ found: true });
    await controller.getPublicPortal('REFCODE1');
    expect(portal.getPortalByReferralCode).toHaveBeenCalledWith('REFCODE1');
  });

  it('returns found:false when loyalty account missing', async () => {
    findFirst.mockResolvedValue(null);
    await expect(controller.getPublicCard('missing')).resolves.toEqual({ found: false });
  });

  it('returns found:false when patron CRM disabled for org', async () => {
    findFirst.mockResolvedValue({
      orgId: 'org-1',
      pointsBalance: 10,
      referralCode: 'ABC',
      customer: { name: 'Pat' },
      organization: { name: 'Org', slug: 'org' },
      tier: null,
    });
    patronCrmFeature.isEnabled.mockResolvedValue(false);
    await expect(controller.getPublicCard('abc')).resolves.toEqual({ found: false });
  });

  it('returns public card payload when account exists and CRM enabled', async () => {
    findFirst.mockResolvedValue({
      orgId: 'org-1',
      pointsBalance: 250,
      referralCode: 'ABC123',
      customer: { name: 'Patron' },
      organization: { name: 'Cafe', slug: 'cafe' },
      tier: { name: 'Gold' },
    });
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    await expect(controller.getPublicCard('abc123')).resolves.toMatchObject({
      found: true,
      patronName: 'Patron',
      orgName: 'Cafe',
      pointsBalance: 250,
      referralCode: 'ABC123',
    });
    expect(findFirst).toHaveBeenCalled();
  });
});
