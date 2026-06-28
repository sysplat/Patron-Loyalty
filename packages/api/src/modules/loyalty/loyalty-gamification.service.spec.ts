import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_PATRON_GAME_TYPES } from '@queueplatform/shared';
import { LoyaltyGamificationService } from './loyalty-gamification.service';

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
