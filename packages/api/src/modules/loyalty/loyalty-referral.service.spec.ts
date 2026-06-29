import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyReferralService } from './loyalty-referral.service';

const ORG_ID = 'org-1';
const REFERRER_CUSTOMER_ID = 'cust-referrer';
const REFERRED_CUSTOMER_ID = 'cust-referred';
const REFERRAL_CODE = 'FRIEND10';

describe('LoyaltyReferralService', () => {
  const patronCrmFeature = {
    requireEnabled: vi.fn().mockResolvedValue(undefined),
    isEnabled: vi.fn().mockResolvedValue(true),
  };
  const accounts = {
    ensureAccount: vi.fn(),
    earnFromEvent: vi.fn().mockResolvedValue(undefined),
  };
  const programService = {
    getOrCreateProgram: vi.fn().mockResolvedValue({
      referralBonusPoints: 50,
      referredBonusPoints: 25,
    }),
  };
  const integration = { upsertCustomer: vi.fn() };
  const prisma = { withTenant: vi.fn(), withBypassRls: vi.fn() };
  let service: LoyaltyReferralService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyReferralService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
      programService as never,
      integration as never,
    );
  });

  it('rejects unknown referral code', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(
      service.applyReferral(ORG_ID, REFERRAL_CODE, REFERRED_CUSTOMER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects self-referral', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'acct-1',
            customerId: REFERRED_CUSTOMER_ID,
          }),
        },
      }),
    );

    await expect(
      service.applyReferral(ORG_ID, REFERRAL_CODE, REFERRED_CUSTOMER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies referral and awards bonus points', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'ref-1' });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyAccount: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'acct-referrer',
              customerId: REFERRER_CUSTOMER_ID,
              customer: { name: 'Alice' },
            }),
          },
        });
      }
      if (callCount === 2) {
        return fn({
          loyaltyReferral: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        });
      }
      return fn({
        loyaltyReferral: { create },
      });
    });
    accounts.ensureAccount.mockResolvedValue({ id: 'acct-referred' });

    const referral = await service.applyReferral(ORG_ID, REFERRAL_CODE, REFERRED_CUSTOMER_ID);

    expect(referral).toEqual({ id: 'ref-1' });
    expect(accounts.earnFromEvent).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        referrerAccountId: 'acct-referrer',
        referredCustomerId: REFERRED_CUSTOMER_ID,
        status: 'completed',
      }),
    });
  });

  it('returns referral stats aggregate', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyReferral: {
          count: vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(8),
          aggregate: vi.fn().mockResolvedValue({
            _sum: { referrerBonusPoints: 100, referredBonusPoints: 50 },
          }),
        },
      }),
    );

    const stats = await service.getReferralStats(ORG_ID);

    expect(stats).toEqual({ total: 10, completed: 8, bonusPointsAwarded: 150 });
  });

  it('returns public landing when code is valid', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            orgId: ORG_ID,
            referralCode: REFERRAL_CODE,
            customer: { name: 'Alice Smith' },
            organization: {
              name: 'Cafe',
              slug: 'cafe',
              loyaltyProgram: { referredBonusPoints: 25, referralBonusPoints: 50 },
            },
          }),
        },
      }),
    );

    const landing = await service.getPublicReferralLanding(REFERRAL_CODE);

    expect(landing).toMatchObject({
      found: true,
      orgName: 'Cafe',
      referrerFirstName: 'Alice',
      referralCode: REFERRAL_CODE,
    });
  });

  it('returns not found for invalid public code', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }),
    );

    const landing = await service.getPublicReferralLanding('INVALID');

    expect(landing).toEqual({ found: false });
  });
});
