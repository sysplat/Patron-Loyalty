import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
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
  const lifecycle = {
    ensureAccount: vi.fn(),
  };
  const programService = {
    getOrCreateProgram: vi.fn().mockResolvedValue({
      referralBonusPoints: 50,
      referredBonusPoints: 25,
    }),
  };
  const integration = { upsertCustomer: vi.fn() };
  const points = { applyPoints: vi.fn().mockResolvedValue({ account: { id: 'acct' } }) };
  const gamification = {
    incrementChallengeProgress: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = { withTenant: vi.fn(), withBypassRls: vi.fn() };
  let service: LoyaltyReferralService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyReferralService(
      prisma as never,
      patronCrmFeature as never,
      lifecycle as never,
      programService as never,
      integration as never,
      points as never,
      gamification as never,
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

  it('applies referral as pending without awarding points', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'ref-1', status: 'pending' });
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
    lifecycle.ensureAccount.mockResolvedValue({ id: 'acct-referred' });

    const referral = await service.applyReferral(ORG_ID, REFERRAL_CODE, REFERRED_CUSTOMER_ID);

    expect(referral).toEqual({ id: 'ref-1', status: 'pending' });
    expect(points.applyPoints).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        referrerAccountId: 'acct-referrer',
        referredCustomerId: REFERRED_CUSTOMER_ID,
        referredAccountId: 'acct-referred',
        status: 'pending',
        referrerBonusPoints: 50,
        referredBonusPoints: 25,
        completedAt: null,
      }),
    });
  });

  it('completes pending referral and awards asymmetric bonuses', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'ref-1', status: 'completed' });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyReferral: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'ref-1',
              referrerAccountId: 'acct-referrer',
              referredAccountId: 'acct-referred',
              referrerBonusPoints: 50,
              referredBonusPoints: 25,
              referrerAccount: { id: 'acct-referrer', customerId: REFERRER_CUSTOMER_ID },
              referredAccount: { id: 'acct-referred', customerId: REFERRED_CUSTOMER_ID },
            }),
          },
        });
      }
      return fn({ loyaltyReferral: { update } });
    });

    const completed = await service.completePendingForCustomer(ORG_ID, REFERRED_CUSTOMER_ID);

    expect(points.applyPoints).toHaveBeenCalledTimes(2);
    expect(points.applyPoints).toHaveBeenNthCalledWith(
      1,
      ORG_ID,
      'acct-referrer',
      50,
      LOYALTY_POINT_LEDGER_TYPES.BONUS,
      expect.objectContaining({
        sourceType: 'referral',
        sourceId: 'ref-1:advocate',
        description: 'Referral bonus (advocate)',
      }),
    );
    expect(points.applyPoints).toHaveBeenNthCalledWith(
      2,
      ORG_ID,
      'acct-referred',
      25,
      LOYALTY_POINT_LEDGER_TYPES.BONUS,
      expect.objectContaining({
        sourceType: 'referral',
        sourceId: 'ref-1:welcome',
        description: 'Welcome referral bonus',
      }),
    );
    expect(update).toHaveBeenCalled();
    expect(completed).toEqual({ id: 'ref-1', status: 'completed' });
    expect(gamification.incrementChallengeProgress).toHaveBeenCalledWith(
      ORG_ID,
      REFERRER_CUSTOMER_ID,
      'REFERRALS',
      1,
    );
  });

  it('returns null when no pending referral to complete', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyReferral: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    expect(await service.completePendingForCustomer(ORG_ID, REFERRED_CUSTOMER_ID)).toBeNull();
    expect(points.applyPoints).not.toHaveBeenCalled();
  });

  it('returns referral stats aggregate including pending', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyReferral: {
          count: vi
            .fn()
            .mockResolvedValueOnce(10)
            .mockResolvedValueOnce(8)
            .mockResolvedValueOnce(2),
          aggregate: vi.fn().mockResolvedValue({
            _sum: { referrerBonusPoints: 100, referredBonusPoints: 50 },
          }),
        },
      }),
    );

    const stats = await service.getReferralStats(ORG_ID);

    expect(stats).toEqual({ total: 10, completed: 8, pending: 2, bonusPointsAwarded: 150 });
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
      completesOnFirstPurchase: true,
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

  it('hides landing when patron CRM is disabled', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(false);
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            orgId: ORG_ID,
            referralCode: REFERRAL_CODE,
            customer: { name: 'Alice' },
            organization: { name: 'Cafe', slug: 'cafe', loyaltyProgram: null },
          }),
        },
      }),
    );

    const landing = await service.getPublicReferralLanding(REFERRAL_CODE);

    expect(landing).toEqual({ found: false });
  });

  it('lists referrals for staff', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'ref-1' }]);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyReferral: { findMany } }),
    );

    const rows = await service.listReferrals(ORG_ID);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, orderBy: { createdAt: 'desc' } }),
    );
    expect(rows).toEqual([{ id: 'ref-1' }]);
  });

  it('joins via public referral and applies code for new patron', async () => {
    vi.spyOn(service, 'getPublicReferralLanding').mockResolvedValue({
      found: true,
      orgName: 'Cafe',
      orgSlug: 'cafe',
      referrerFirstName: 'Alice',
      referralCode: REFERRAL_CODE,
      referredBonusPoints: 25,
      referrerBonusPoints: 50,
      completesOnFirstPurchase: true,
    });
    const applySpy = vi.spyOn(service, 'applyReferral').mockResolvedValue({ id: 'ref-2' } as never);
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            orgId: ORG_ID,
            customerId: REFERRER_CUSTOMER_ID,
          }),
        },
      }),
    );
    integration.upsertCustomer.mockResolvedValue({
      customerId: REFERRED_CUSTOMER_ID,
      created: true,
    });
    let tenantCalls = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      tenantCalls += 1;
      if (tenantCalls === 1) {
        return fn({
          loyaltyReferral: { findFirst: vi.fn().mockResolvedValue(null) },
        });
      }
      return fn({
        loyaltyAccount: {
          findUnique: vi.fn().mockResolvedValue({ referralCode: 'NEWCODE', pointsBalance: 0 }),
        },
      });
    });

    const result = await service.joinViaPublicReferral(REFERRAL_CODE, {
      name: 'Bob',
      email: 'bob@example.com',
    });

    expect(applySpy).toHaveBeenCalledWith(ORG_ID, REFERRAL_CODE, REFERRED_CUSTOMER_ID);
    expect(result).toEqual({
      joined: true,
      referralApplied: true,
      referralStatus: 'pending',
      portalCode: 'NEWCODE',
      pointsBalance: 0,
      referredBonusPoints: 25,
      completesOnFirstPurchase: true,
    });
  });

  it('joins without re-applying when referral already exists', async () => {
    vi.spyOn(service, 'getPublicReferralLanding').mockResolvedValue({
      found: true,
      orgName: 'Cafe',
      orgSlug: 'cafe',
      referrerFirstName: 'Alice',
      referralCode: REFERRAL_CODE,
      referredBonusPoints: 25,
      referrerBonusPoints: 50,
      completesOnFirstPurchase: true,
    });
    const applySpy = vi.spyOn(service, 'applyReferral');
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            orgId: ORG_ID,
            customerId: REFERRER_CUSTOMER_ID,
          }),
        },
      }),
    );
    integration.upsertCustomer.mockResolvedValue({ customerId: REFERRED_CUSTOMER_ID });
    let tenantCalls = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      tenantCalls += 1;
      if (tenantCalls === 1) {
        return fn({
          loyaltyReferral: {
            findFirst: vi.fn().mockResolvedValue({ id: 'existing', status: 'pending' }),
          },
        });
      }
      return fn({
        loyaltyAccount: {
          findUnique: vi.fn().mockResolvedValue({ referralCode: 'CODE', pointsBalance: 10 }),
        },
      });
    });

    const result = await service.joinViaPublicReferral(REFERRAL_CODE, { name: 'Bob' });

    expect(applySpy).not.toHaveBeenCalled();
    expect(result.referralApplied).toBe(false);
    expect(result.referralStatus).toBe('pending');
  });

  it('rejects self-join via public referral', async () => {
    vi.spyOn(service, 'getPublicReferralLanding').mockResolvedValue({
      found: true,
      orgName: 'Cafe',
      orgSlug: 'cafe',
      referrerFirstName: 'Alice',
      referralCode: REFERRAL_CODE,
      referredBonusPoints: 25,
      referrerBonusPoints: 50,
      completesOnFirstPurchase: true,
    });
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            orgId: ORG_ID,
            customerId: REFERRER_CUSTOMER_ID,
          }),
        },
      }),
    );
    integration.upsertCustomer.mockResolvedValue({ customerId: REFERRER_CUSTOMER_ID });

    await expect(
      service.joinViaPublicReferral(REFERRAL_CODE, { name: 'Alice' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
