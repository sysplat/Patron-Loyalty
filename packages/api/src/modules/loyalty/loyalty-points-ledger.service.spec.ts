import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import { LoyaltyPointsLedgerService } from './loyalty-points-ledger.service';
import { isDebitLedgerType, isLifetimeEarnType } from './loyalty-points.types';

const ORG_ID = 'org-1';
const ACCOUNT_ID = 'acct-1';

function accountAfter(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCOUNT_ID,
    orgId: ORG_ID,
    customerId: 'cust-1',
    pointsBalance: 40,
    lifetimePointsEarned: 100,
    lifetimePointsBurned: 10,
    totalVisits: 2,
    tierId: null,
    tier: null,
    customer: { id: 'cust-1', name: 'Patron' },
    ...overrides,
  };
}

describe('loyalty-points.types helpers', () => {
  it('treats BURN and EXPIRE as debits', () => {
    expect(isDebitLedgerType(LOYALTY_POINT_LEDGER_TYPES.BURN)).toBe(true);
    expect(isDebitLedgerType(LOYALTY_POINT_LEDGER_TYPES.EXPIRE)).toBe(true);
    expect(isDebitLedgerType(LOYALTY_POINT_LEDGER_TYPES.EARN)).toBe(false);
  });

  it('treats EARN and BONUS as lifetime earn types', () => {
    expect(isLifetimeEarnType(LOYALTY_POINT_LEDGER_TYPES.EARN)).toBe(true);
    expect(isLifetimeEarnType(LOYALTY_POINT_LEDGER_TYPES.BONUS)).toBe(true);
    expect(isLifetimeEarnType(LOYALTY_POINT_LEDGER_TYPES.ADJUST)).toBe(false);
  });
});

describe('LoyaltyPointsLedgerService', () => {
  const metrics = { resolveTierForPoints: vi.fn(), refreshHealthScore: vi.fn() };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyPointsLedgerService;

  beforeEach(() => {
    vi.clearAllMocks();
    metrics.resolveTierForPoints.mockResolvedValue(null);
    metrics.refreshHealthScore.mockResolvedValue(undefined);
    service = new LoyaltyPointsLedgerService(prisma as never, metrics as never);
  });

  it('returns idempotent result when earn ledger already exists', async () => {
    const tx = {
      loyaltyPointLedger: {
        findFirst: vi.fn().mockResolvedValue({ points: 10 }),
      },
      loyaltyAccount: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(accountAfter()),
      },
    };

    const result = await service.applyPointsInTransaction(
      tx as never,
      ORG_ID,
      ACCOUNT_ID,
      10,
      LOYALTY_POINT_LEDGER_TYPES.EARN,
      { sourceType: 'ticket', sourceId: 't-1' },
    );

    expect(result.idempotent).toBe(true);
    expect(result.delta).toBe(0);
  });

  it('throws when burn exceeds balance', async () => {
    const tx = {
      loyaltyPointLedger: { findFirst: vi.fn().mockResolvedValue(null) },
      loyaltyAccount: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ id: ACCOUNT_ID }),
      },
    };

    await expect(
      service.applyPointsInTransaction(
        tx as never,
        ORG_ID,
        ACCOUNT_ID,
        50,
        LOYALTY_POINT_LEDGER_TYPES.BURN,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('EXPIRE decrements balance and does not inflate lifetime burned', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({});
    const after = accountAfter({ pointsBalance: 0, lifetimePointsBurned: 10 });
    const tx = {
      loyaltyPointLedger: { findFirst: vi.fn().mockResolvedValue(null), create },
      loyaltyAccount: {
        updateMany,
        findFirstOrThrow: vi.fn().mockResolvedValue(after),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...after, customer: after.customer }),
        update: vi.fn(),
      },
    };

    const result = await service.applyPointsInTransaction(
      tx as never,
      ORG_ID,
      ACCOUNT_ID,
      50,
      LOYALTY_POINT_LEDGER_TYPES.EXPIRE,
      { sourceType: 'expiry', description: 'expired' },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, orgId: ORG_ID, pointsBalance: { gte: 50 } },
      data: { pointsBalance: { decrement: 50 } },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: LOYALTY_POINT_LEDGER_TYPES.EXPIRE,
          points: -50,
          balanceAfter: 0,
        }),
      }),
    );
    expect(result.delta).toBe(-50);
    expect(result.points).toBe(50);
  });

  it('EARN uses atomic increment instead of absolute balance write', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({});
    const after = accountAfter({ pointsBalance: 60, lifetimePointsEarned: 110 });
    const tx = {
      loyaltyPointLedger: { findFirst: vi.fn().mockResolvedValue(null), create },
      loyaltyAccount: {
        updateMany,
        findFirstOrThrow: vi.fn().mockResolvedValue(after),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...after, customer: after.customer }),
        update: vi.fn(),
      },
    };

    const result = await service.applyPointsInTransaction(
      tx as never,
      ORG_ID,
      ACCOUNT_ID,
      10,
      LOYALTY_POINT_LEDGER_TYPES.EARN,
      { sourceType: 'ticket', sourceId: 't-2', incrementVisit: true },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, orgId: ORG_ID },
      data: {
        pointsBalance: { increment: 10 },
        lifetimePointsEarned: { increment: 10 },
        totalVisits: { increment: 1 },
      },
    });
    expect(result.delta).toBe(10);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ points: 10, balanceAfter: 60 }),
      }),
    );
  });

  it('ADJUST credits with atomic increment without touching lifetime earned', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const after = accountAfter({ pointsBalance: 55, lifetimePointsEarned: 100 });
    const tx = {
      loyaltyPointLedger: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      loyaltyAccount: {
        updateMany,
        findFirstOrThrow: vi.fn().mockResolvedValue(after),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...after, customer: after.customer }),
        update: vi.fn(),
      },
    };

    await service.applyPointsInTransaction(
      tx as never,
      ORG_ID,
      ACCOUNT_ID,
      5,
      LOYALTY_POINT_LEDGER_TYPES.ADJUST,
      {},
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, orgId: ORG_ID },
      data: {
        pointsBalance: { increment: 5 },
      },
    });
  });

  it('throws NotFound when credit targets missing account', async () => {
    const tx = {
      loyaltyPointLedger: { findFirst: vi.fn().mockResolvedValue(null) },
      loyaltyAccount: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      service.applyPointsInTransaction(
        tx as never,
        ORG_ID,
        ACCOUNT_ID,
        10,
        LOYALTY_POINT_LEDGER_TYPES.EARN,
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects non-positive points amounts', async () => {
    await expect(
      service.applyPointsInTransaction(
        {} as never,
        ORG_ID,
        ACCOUNT_ID,
        0,
        LOYALTY_POINT_LEDGER_TYPES.EARN,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
