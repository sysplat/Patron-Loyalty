import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyPortalService } from './loyalty-portal.service';

describe('LoyaltyPortalService', () => {
  const prisma = {
    withBypassRls: vi.fn(),
    withTenant: vi.fn(),
  };
  const patronCrmFeature = {
    isEnabled: vi.fn().mockResolvedValue(true),
  };
  const accounts = {} as never;
  const catalog = {} as never;
  const requestContext = {} as never;
  const gamification = {
    getPatronGameStatus: vi.fn(),
  };

  let service: LoyaltyPortalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyPortalService(
      prisma as never,
      patronCrmFeature as never,
      accounts,
      catalog,
      requestContext,
      gamification as never,
    );
  });

  it('returns found false for unknown referral code', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }),
    );

    const result = await service.getPortalByReferralCode('UNKNOWN');
    expect(result).toEqual({ found: false });
  });

  it('returns found false when patron CRM is disabled for org', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'acc-1',
            orgId: 'org-1',
            customerId: 'cust-1',
            pointsBalance: 100,
            lifetimePointsEarned: 200,
            referralCode: 'REF1',
            totalVisits: 3,
            tier: null,
            customer: { name: 'Pat', birthday: null },
            organization: {
              name: 'Cafe',
              slug: 'cafe',
              loyaltyProgram: { pointsCurrencyName: 'Stars' },
            },
            badges: [],
            challengeProgress: [],
            wallet: { id: 'w-1', balanceCents: 0, currency: 'USD' },
          }),
        },
      }),
    );
    patronCrmFeature.isEnabled.mockResolvedValue(false);

    const result = await service.getPortalByReferralCode('REF1');
    expect(result).toEqual({ found: false });
  });
});
