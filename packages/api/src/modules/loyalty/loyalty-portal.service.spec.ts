import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CURRENT_LOYALTY_PATRON_PRIVACY_VERSION,
  CURRENT_LOYALTY_PATRON_TERMS_VERSION,
} from '@queueplatform/shared';
import { LoyaltyPortalService } from './loyalty-portal.service';

const accountRow = {
  id: 'acc-1',
  orgId: 'org-1',
  customerId: 'cust-1',
  pointsBalance: 250,
  lifetimePointsEarned: 400,
  referralCode: 'REF1',
  totalVisits: 3,
  tier: { name: 'Silver' },
  customer: { name: 'Pat', birthday: null },
  organization: {
    name: 'Cafe',
    slug: 'cafe',
    loyaltyProgram: { pointsCurrencyName: 'Stars' },
  },
  badges: [],
  challengeProgress: [],
  wallet: { id: 'w-1', balanceCents: 500, currency: 'USD' },
};

describe('LoyaltyPortalService', () => {
  const prisma = {
    withBypassRls: vi.fn(),
    withTenant: vi.fn(),
  };
  const patronCrmFeature = {
    isEnabled: vi.fn().mockResolvedValue(true),
  };
  const accounts = {} as never;
  const catalog = {
    redeemReward: vi.fn().mockResolvedValue({ id: 'red-1' }),
  };
  const requestContext = {
    getContext: vi.fn().mockReturnValue({ ip: '127.0.0.1', userAgent: 'vitest' }),
  };
  const gamification = {
    getPatronGameStatus: vi.fn().mockResolvedValue({ canPlay: true }),
    playPatronGame: vi.fn().mockResolvedValue({ prize: 10 }),
  };

  let service: LoyaltyPortalService;

  beforeEach(() => {
    vi.clearAllMocks();
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    service = new LoyaltyPortalService(
      prisma as never,
      patronCrmFeature as never,
      accounts,
      catalog as never,
      requestContext as never,
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
          findFirst: vi.fn().mockResolvedValue(accountRow),
        },
      }),
    );
    patronCrmFeature.isEnabled.mockResolvedValue(false);

    const result = await service.getPortalByReferralCode('REF1');
    expect(result).toEqual({ found: false });
  });

  const mockBypassAccount = () => ({
    loyaltyAccount: {
      findFirst: vi.fn().mockImplementation((args: { select?: unknown; include?: unknown }) => {
        if (args?.select) {
          return Promise.resolve({ id: 'acc-1', orgId: 'org-1', customerId: 'cust-1' });
        }
        return Promise.resolve(accountRow);
      }),
    },
  });

  it('returns full portal payload when account exists', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(mockBypassAccount()),
    );
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        consentLedgerEntry: { findFirst: vi.fn().mockResolvedValue({ id: 'consent-1' }) },
        loyaltyReward: {
          findMany: vi.fn().mockResolvedValue([{ id: 'r1', name: 'Coffee', pointsCost: 100 }]),
        },
        loyaltyPointLedger: { findMany: vi.fn().mockResolvedValue([]) },
        loyaltyWalletTransaction: { findMany: vi.fn().mockResolvedValue([]) },
      }),
    );

    const result = await service.getPortalByReferralCode('ref1');

    expect(result).toMatchObject({
      found: true,
      patronName: 'Pat',
      pointsBalance: 250,
      legalConsentGranted: true,
    });
  });

  it('redeems reward after legal consent', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(mockBypassAccount()),
    );
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        consentLedgerEntry: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      }),
    );

    const result = await service.redeemReward('REF1', 'reward-1');
    expect(catalog.redeemReward).toHaveBeenCalledWith('org-1', 'cust-1', 'reward-1');
    expect(result).toMatchObject({ success: true });
  });

  it('blocks redeem without legal consent', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(mockBypassAccount()),
    );
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        consentLedgerEntry: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    await expect(service.redeemReward('REF1', 'reward-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('updates profile birthday', async () => {
    const customerUpdate = vi.fn().mockResolvedValue({});
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(mockBypassAccount()),
    );
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        consentLedgerEntry: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
        customer: { update: customerUpdate },
      }),
    );

    await service.updateProfile('REF1', { birthday: '1990-01-15' });
    expect(customerUpdate).toHaveBeenCalled();
  });

  it('records patron legal consent', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'new-consent' });
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(mockBypassAccount()),
    );
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        consentLedgerEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          create,
        },
      }),
    );

    const result = await service.recordPatronLegalConsent('REF1', {
      termsVersion: CURRENT_LOYALTY_PATRON_TERMS_VERSION,
      privacyVersion: CURRENT_LOYALTY_PATRON_PRIVACY_VERSION,
    });

    expect(result.legalConsentGranted).toBe(true);
    expect(create).toHaveBeenCalled();
  });

  it('throws when playing game for unknown code', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );
    await expect(service.playPatronGame('BAD', 'spin_wheel')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
