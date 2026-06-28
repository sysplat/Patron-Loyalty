import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import { LoyaltyPointsService } from './loyalty-points.service';

const baseAccount = {
  id: 'acc-1',
  orgId: 'org-1',
  customerId: 'cust-1',
  pointsBalance: 10,
  lifetimePointsEarned: 10,
  lifetimePointsBurned: 0,
  totalVisits: 1,
  tierId: null,
  tier: null,
  healthScore: 80,
  churnRisk: 'low',
  customer: { id: 'cust-1', name: 'Patron' },
};

describe('LoyaltyPointsService applyPoints idempotency', () => {
  const eventEmitter = { emit: vi.fn() };
  const loyaltyWebhook = { dispatch: vi.fn() };
  const prisma = { withTenant: vi.fn() };

  const ledgerFindFirst = vi.fn();
  const ledgerCreate = vi.fn();
  const accountFindFirst = vi.fn();
  const accountUpdate = vi.fn();
  const accountFindUniqueOrThrow = vi.fn();

  let service: LoyaltyPointsService;

  beforeEach(() => {
    vi.clearAllMocks();
    ledgerFindFirst.mockResolvedValue(null);
    ledgerCreate.mockResolvedValue({ id: 'ledger-1' });
    accountFindFirst.mockResolvedValue({ ...baseAccount });
    accountUpdate.mockResolvedValue({
      ...baseAccount,
      pointsBalance: 20,
      tierId: null,
      tier: null,
    });
    accountFindUniqueOrThrow.mockResolvedValue({
      ...baseAccount,
      pointsBalance: 20,
    });

    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyPointLedger: {
          findFirst: ledgerFindFirst,
          create: ledgerCreate,
        },
        loyaltyAccount: {
          findFirst: accountFindFirst,
          update: accountUpdate,
          findUniqueOrThrow: accountFindUniqueOrThrow,
        },
        loyaltyTier: { findFirst: vi.fn().mockResolvedValue(null) },
        ticket: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    service = new LoyaltyPointsService(
      prisma as never,
      eventEmitter as never,
      loyaltyWebhook as never,
    );
  });

  it('creates ledger row on first earn', async () => {
    const result = await service.applyPoints(
      'org-1',
      'acc-1',
      10,
      LOYALTY_POINT_LEDGER_TYPES.EARN,
      { sourceType: 'integration', sourceId: 'txn-1', description: 'Test earn' },
    );

    expect(result.idempotent).toBe(false);
    expect(ledgerCreate).toHaveBeenCalledOnce();
    expect(accountUpdate).toHaveBeenCalled();
    expect(loyaltyWebhook.dispatch).toHaveBeenCalled();
  });

  it('returns idempotent result when earn source already exists', async () => {
    ledgerFindFirst.mockResolvedValue({ id: 'ledger-1', points: 10 });

    const result = await service.applyPoints(
      'org-1',
      'acc-1',
      10,
      LOYALTY_POINT_LEDGER_TYPES.EARN,
      { sourceType: 'ticket', sourceId: 'ticket-1' },
    );

    expect(result.idempotent).toBe(true);
    expect(ledgerCreate).not.toHaveBeenCalled();
    expect(accountUpdate).not.toHaveBeenCalled();
    expect(loyaltyWebhook.dispatch).not.toHaveBeenCalled();
  });

  it('dedupes on orgId + accountId + sourceType + sourceId + type', async () => {
    await service.applyPoints('org-1', 'acc-1', 10, LOYALTY_POINT_LEDGER_TYPES.EARN, {
      sourceType: 'ticket',
      sourceId: 'ticket-2',
    });

    expect(ledgerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: 'org-1',
          accountId: 'acc-1',
          sourceType: 'ticket',
          sourceId: 'ticket-2',
          type: LOYALTY_POINT_LEDGER_TYPES.EARN,
        }),
      }),
    );
  });

  it('skips side effects when dispatchApplyPointsSideEffects sees idempotent tx result', () => {
    service.dispatchApplyPointsSideEffects(
      'org-1',
      'acc-1',
      {
        finalAccount: baseAccount,
        type: LOYALTY_POINT_LEDGER_TYPES.EARN,
        points: 10,
        delta: 0,
        customerId: 'cust-1',
        idempotent: true,
      },
      { sourceType: 'ticket', sourceId: 'ticket-1' },
    );

    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(loyaltyWebhook.dispatch).not.toHaveBeenCalled();
  });
});
