import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_PATRON_GAME_TYPES } from '@queueplatform/shared';
import { LoyaltyGamificationService } from './loyalty-gamification.service';

describe('LoyaltyGamificationService catalog', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = {};
  let service: LoyaltyGamificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyGamificationService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
    );
  });

  it('lists and creates badges', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'b1' }]);
    const create = vi.fn().mockResolvedValue({ id: 'b-new' });
    let call = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      call += 1;
      if (call === 1) return fn({ loyaltyBadge: { findMany } });
      return fn({ loyaltyBadge: { create } });
    });

    const badges = await service.listBadges('org-1');
    const created = await service.createBadge('org-1', { name: 'Regular', criteria: {} });

    expect(badges).toEqual([{ id: 'b1' }]);
    expect(created).toEqual({ id: 'b-new' });
  });

  it('lists and creates challenges', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'c1' }]);
    const create = vi.fn().mockResolvedValue({ id: 'c-new' });
    let call = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      call += 1;
      if (call === 1) return fn({ loyaltyChallenge: { findMany } });
      return fn({ loyaltyChallenge: { create } });
    });

    const challenges = await service.listChallenges('org-1');
    const created = await service.createChallenge('org-1', { name: 'Visits', targetType: 'visit' });

    expect(challenges).toEqual([{ id: 'c1' }]);
    expect(created).toEqual({ id: 'c-new' });
  });
});

describe('LoyaltyGamificationService evaluateBadgesForAccount', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = {
    ensureAccount: vi.fn().mockResolvedValue({
      id: 'acc-1',
      totalVisits: 10,
      lifetimePointsEarned: 500,
    }),
  };
  let service: LoyaltyGamificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyGamificationService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
    );
    vi.spyOn(service, 'listBadges').mockResolvedValue([
      {
        id: 'badge-1',
        name: 'Regular',
        criteria: { minVisits: 5, minPoints: 100 },
      },
    ] as never);
  });

  it('awards badge when criteria met and not yet earned', async () => {
    const create = vi.fn().mockResolvedValue({});
    let call = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      call += 1;
      if (call === 1) {
        return fn({
          customerBadge: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        });
      }
      return fn({ customerBadge: { create } });
    });

    const awarded = await service.evaluateBadgesForAccount('org-1', 'cust-1');

    expect(awarded).toEqual(['Regular']);
    expect(create).toHaveBeenCalled();
  });

  it('returns empty when account missing', async () => {
    accounts.ensureAccount.mockResolvedValue(null);

    const awarded = await service.evaluateBadgesForAccount('org-1', 'cust-1');

    expect(awarded).toEqual([]);
  });

  it('skips badge when criteria not met', async () => {
    vi.spyOn(service, 'listBadges').mockResolvedValue([
      { id: 'badge-1', name: 'VIP', criteria: { minVisits: 100 } },
    ] as never);

    const awarded = await service.evaluateBadgesForAccount('org-1', 'cust-1');

    expect(awarded).toEqual([]);
    expect(prisma.withTenant).not.toHaveBeenCalled();
  });
});

describe('LoyaltyGamificationService incrementChallengeProgress', () => {
  const patronCrmFeature = { requireEnabled: vi.fn() };
  const prisma = { withTenant: vi.fn() };
  const accounts = {
    ensureAccount: vi.fn(),
    adjustPoints: vi.fn(),
    dispatchApplyPointsSideEffects: vi.fn(),
  };

  const challengeFindMany = vi.fn();
  const progressUpsert = vi.fn();
  const progressUpdate = vi.fn();

  let service: LoyaltyGamificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    accounts.ensureAccount.mockResolvedValue({ id: 'acc-1' });
    challengeFindMany.mockResolvedValue([
      {
        id: 'ch-1',
        name: 'Visit 5 times',
        targetType: 'visit',
        targetValue: 5,
        rewardPoints: 50,
      },
    ]);
    progressUpsert.mockResolvedValue({
      id: 'prog-1',
      progress: 5,
      completedAt: null,
    });
    progressUpdate.mockResolvedValue({});
    accounts.adjustPoints.mockResolvedValue({
      finalAccount: { id: 'acc-1', pointsBalance: 150 },
      idempotent: false,
      type: 'ADJUST',
      points: 50,
      delta: 50,
      customerId: 'cust-1',
    });

    let call = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      call += 1;
      if (call === 1) {
        return fn({ loyaltyChallenge: { findMany: challengeFindMany } });
      }
      return fn({
        customerChallengeProgress: {
          upsert: progressUpsert,
          update: progressUpdate,
        },
      });
    });

    service = new LoyaltyGamificationService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
    );
  });

  it('awards challenge points in the same transaction as completion', async () => {
    await service.incrementChallengeProgress('org-1', 'cust-1', 'visit');

    expect(accounts.adjustPoints).toHaveBeenCalledWith(
      'org-1',
      'cust-1',
      50,
      'Challenge completed: Visit 5 times',
      expect.any(Object),
    );
    expect(accounts.dispatchApplyPointsSideEffects).toHaveBeenCalledOnce();
  });
});

describe('LoyaltyGamificationService playPatronGame', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = {
    adjustPoints: vi.fn(),
    dispatchApplyPointsSideEffects: vi.fn(),
  };

  const gamePlayFindFirst = vi.fn();
  const accountFindFirst = vi.fn();
  const gamePlayCreate = vi.fn();

  let service: LoyaltyGamificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    gamePlayFindFirst.mockResolvedValue(null);
    accountFindFirst.mockResolvedValue({ customerId: 'cust-1' });
    gamePlayCreate.mockResolvedValue({ id: 'play-1' });
    accounts.adjustPoints.mockResolvedValue({
      finalAccount: { id: 'acc-1', pointsBalance: 60 },
      idempotent: false,
      type: 'ADJUST',
      points: 10,
      delta: 10,
      customerId: 'cust-1',
    });

    let call = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      call += 1;
      if (call === 1 || call === 2) {
        return fn({ loyaltyPatronGamePlay: { findFirst: gamePlayFindFirst } });
      }
      if (call === 3) {
        return fn({ loyaltyAccount: { findFirst: accountFindFirst } });
      }
      return fn({
        loyaltyPatronGamePlay: { create: gamePlayCreate },
      });
    });

    service = new LoyaltyGamificationService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
    );

    vi.spyOn(service as never, 'pickWeighted' as never).mockReturnValue({
      label: '10 bonus points',
      points: 10,
      weight: 40,
    } as never);
  });

  it('records game play and awards points in one transaction', async () => {
    const result = await service.playPatronGame(
      'org-1',
      'acc-1',
      LOYALTY_PATRON_GAME_TYPES.SPIN_WHEEL,
    );

    expect(gamePlayCreate).toHaveBeenCalledOnce();
    expect(accounts.adjustPoints).toHaveBeenCalledWith(
      'org-1',
      'cust-1',
      10,
      expect.stringContaining('Patron spin wheel'),
      expect.any(Object),
    );
    expect(accounts.dispatchApplyPointsSideEffects).toHaveBeenCalledOnce();
    expect(result.pointsAwarded).toBe(10);
  });
});
