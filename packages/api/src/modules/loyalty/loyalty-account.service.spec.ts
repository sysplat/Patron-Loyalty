import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LOYALTY_EARN_EVENT_TYPES, LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyAccountLifecycleService } from './loyalty-account-lifecycle.service';
import { LoyaltyAccountEarnService } from './loyalty-account-earn.service';
import { LoyaltyAccountDsarService } from './loyalty-account-dsar.service';
import { LoyaltyPointsService } from './loyalty-points.service';
import { LoyaltyPointsLedgerService } from './loyalty-points-ledger.service';
import { LoyaltyPointsMetricsService } from './loyalty-points-metrics.service';

function buildAccountService(deps: {
  prisma: unknown;
  patronCrmFeature: unknown;
  programService: unknown;
  loyaltyWebhook: unknown;
  eventEmitter: unknown;
  marketingSync?: unknown;
}) {
  const ledger = new LoyaltyPointsLedgerService(
    deps.prisma as never,
    new LoyaltyPointsMetricsService(),
  );
  const marketingSync = deps.marketingSync || { syncProfile: vi.fn() };
  const points = new LoyaltyPointsService(
    ledger,
    deps.eventEmitter as never,
    deps.loyaltyWebhook as never,
    marketingSync as never,
  );
  const lifecycle = new LoyaltyAccountLifecycleService(
    deps.prisma as never,
    deps.patronCrmFeature as never,
    deps.programService as never,
  );
  const earn = new LoyaltyAccountEarnService(
    deps.prisma as never,
    deps.patronCrmFeature as never,
    deps.programService as never,
    deps.loyaltyWebhook as never,
    lifecycle,
    points,
  );
  const dsar = new LoyaltyAccountDsarService(deps.prisma as never, deps.patronCrmFeature as never);
  const service = new LoyaltyAccountService(lifecycle, earn, dsar, points);
  return { service, lifecycle };
}

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
};

describe('LoyaltyAccountService lookupPatronByPhone', () => {
  const patronCrmFeature = {
    requireEnabled: vi.fn().mockResolvedValue(undefined),
    isEnabled: vi.fn().mockResolvedValue(true),
  };
  const programService = {
    getOrCreateProgram: vi.fn(),
    generateUniqueReferralCode: vi.fn(),
    resolveEarnPoints: vi.fn(),
  };
  const eventEmitter = { emit: vi.fn() };
  const loyaltyWebhook = { dispatch: vi.fn() };
  const prisma = { withTenant: vi.fn() };

  let service: LoyaltyAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildAccountService({
      prisma,
      patronCrmFeature,
      programService,
      loyaltyWebhook,
      eventEmitter,
    }).service;
  });

  it('rejects phone numbers with fewer than 10 digits', async () => {
    await expect(service.lookupPatronByPhone('org-1', '12345')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(patronCrmFeature.requireEnabled).toHaveBeenCalledWith('org-1');
  });

  it('returns found false when no customer matches', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        customer: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    const result = await service.lookupPatronByPhone('org-1', '+1 (555) 123-4567');
    expect(result).toEqual({ found: false });
  });
});

describe('LoyaltyAccountService earn idempotency', () => {
  const patronCrmFeature = {
    requireEnabled: vi.fn().mockResolvedValue(undefined),
    isEnabled: vi.fn().mockResolvedValue(true),
  };
  const programService = {
    getOrCreateProgram: vi.fn().mockResolvedValue({}),
    generateUniqueReferralCode: vi.fn(),
    resolveEarnPoints: vi.fn().mockResolvedValue(10),
  };
  const eventEmitter = { emit: vi.fn() };
  const loyaltyWebhook = { dispatch: vi.fn() };
  const prisma = { withTenant: vi.fn() };

  const ledgerFindFirst = vi.fn();
  const ledgerCreate = vi.fn();
  const accountFindFirst = vi.fn();
  const accountUpdate = vi.fn();
  const accountFindUniqueOrThrow = vi.fn();

  let service: LoyaltyAccountService;
  let lifecycle: LoyaltyAccountLifecycleService;

  beforeEach(() => {
    vi.clearAllMocks();
    ledgerFindFirst.mockResolvedValue(null);
    ledgerCreate.mockResolvedValue({ id: 'ledger-1' });
    accountFindFirst.mockResolvedValue({
      ...baseAccount,
      customer: { id: 'cust-1', name: 'Patron', phone: null, email: null },
    });
    accountUpdate.mockResolvedValue({
      ...baseAccount,
      pointsBalance: 20,
      tierId: null,
      tier: null,
    });
    accountFindUniqueOrThrow.mockResolvedValue({
      ...baseAccount,
      pointsBalance: 20,
      customer: { id: 'cust-1', name: 'Patron' },
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

    const built = buildAccountService({
      prisma,
      patronCrmFeature,
      programService,
      loyaltyWebhook,
      eventEmitter,
    });
    service = built.service;
    lifecycle = built.lifecycle;

    vi.spyOn(lifecycle, 'ensureAccount').mockResolvedValue({
      ...baseAccount,
      customer: { id: 'cust-1', name: 'Patron', email: null, phone: null },
    } as never);
  });

  it('awards points on first ticket.completed earn', async () => {
    const result = await service.handleTicketCompleted('org-1', 'ticket-1', 'cust-1', 'branch-1');

    expect(result?.idempotent).toBe(false);
    expect(ledgerCreate).toHaveBeenCalledOnce();
    expect(accountUpdate).toHaveBeenCalled();
    expect(loyaltyWebhook.dispatch).toHaveBeenCalled();
  });

  it('returns idempotent without creating a second ledger row for the same ticket', async () => {
    ledgerFindFirst.mockResolvedValue({ id: 'ledger-1', points: 10 });
    accountFindUniqueOrThrow.mockResolvedValue({
      ...baseAccount,
      pointsBalance: 20,
      customer: { id: 'cust-1', name: 'Patron' },
    });

    const result = await service.handleTicketCompleted('org-1', 'ticket-1', 'cust-1', 'branch-1');

    expect(result).toEqual({
      account: expect.objectContaining({ id: 'acc-1', pointsBalance: 20 }),
      idempotent: true,
    });
    expect(ledgerCreate).not.toHaveBeenCalled();
    expect(accountUpdate).not.toHaveBeenCalled();
    expect(loyaltyWebhook.dispatch).not.toHaveBeenCalled();
  });

  it('dedupes on accountId + sourceType + sourceId for earn rows', async () => {
    await service.earnFromEvent(
      'org-1',
      'cust-1',
      LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
      { sourceType: 'ticket', sourceId: 'ticket-2', description: 'Points for completed visit' },
      true,
    );

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
});
