import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_EARN_EVENT_TYPES, LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import { LoyaltyIntegrationService } from './loyalty-integration.service';

describe('LoyaltyIntegrationService earnPoints', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const customers = {};
  const accounts = {
    ensureAccount: vi.fn(),
    earnIntegrationPoints: vi.fn(),
  };
  const catalog = {};
  const program = { resolveEarnPoints: vi.fn() };
  const wallet = {};

  let service: LoyaltyIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyPointLedger: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );
    accounts.ensureAccount.mockResolvedValue({
      id: 'acc-1',
      tier: null,
      lifetimePointsEarned: 0,
    });
    accounts.earnIntegrationPoints.mockResolvedValue({
      id: 'acc-1',
      pointsBalance: 50,
    });
    program.resolveEarnPoints.mockResolvedValue(25);

    service = new LoyaltyIntegrationService(
      prisma as never,
      customers as never,
      accounts as never,
      catalog as never,
      program as never,
      wallet as never,
      patronCrmFeature as never,
    );

    vi.spyOn(service, 'resolveCustomerOrThrow' as never).mockResolvedValue({
      id: 'cust-1',
      name: 'Patron',
    } as never);
  });

  it('uses resolveEarnPoints with purchaseAmountCents for purchase-based earn', async () => {
    await service.earnPoints('org-1', {
      customerId: 'cust-1',
      purchaseAmountCents: 5000,
      eventType: LOYALTY_EARN_EVENT_TYPES.PURCHASE,
      externalTxnId: 'INV-2024-001',
    });

    expect(program.resolveEarnPoints).toHaveBeenCalledWith(
      'org-1',
      LOYALTY_EARN_EVENT_TYPES.PURCHASE,
      expect.objectContaining({ purchaseAmountCents: 5000 }),
    );
    expect(accounts.earnIntegrationPoints).toHaveBeenCalledWith(
      'org-1',
      'acc-1',
      25,
      expect.objectContaining({ sourceId: 'INV-2024-001' }),
    );
  });

  it('dedupes integration earn on org + integration source + EARN type', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyPointLedger: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'ledger-1',
            accountId: 'acc-1',
            points: 10,
          }),
        },
      }),
    );

    const result = await service.earnPoints('org-1', {
      customerId: 'cust-1',
      points: 10,
      eventType: LOYALTY_EARN_EVENT_TYPES.MANUAL,
      externalTxnId: 'txn-1',
    });

    expect(result).toEqual({ idempotent: true, accountId: 'acc-1', points: 10 });
    expect(accounts.earnIntegrationPoints).not.toHaveBeenCalled();
    expect(prisma.withTenant.mock.calls[0]).toBeDefined();
    const txFn = prisma.withTenant.mock.calls[0][1] as (tx: {
      loyaltyPointLedger: { findFirst: ReturnType<typeof vi.fn> };
    }) => unknown;
    const findFirst = vi.fn().mockResolvedValue(null);
    await txFn({ loyaltyPointLedger: { findFirst } });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: LOYALTY_POINT_LEDGER_TYPES.EARN,
          sourceType: 'integration',
        }),
      }),
    );
  });
});

describe('LoyaltyIntegrationService lookupCustomer externalId', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const customers = {};
  const accounts = {
    ensureAccount: vi.fn().mockResolvedValue({
      id: 'acc-1',
      pointsBalance: 100,
      referralCode: 'REF1',
    }),
  };
  const catalog = {};
  const program = {};
  const wallet = {};

  let service: LoyaltyIntegrationService;
  const customerFindFirst = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ customer: { findFirst: customerFindFirst } }),
    );
    customerFindFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Connector Patron',
      email: 'p@example.com',
      phone: '+15551234567',
    });

    service = new LoyaltyIntegrationService(
      prisma as never,
      customers as never,
      accounts as never,
      catalog as never,
      program as never,
      wallet as never,
      patronCrmFeature as never,
    );
  });

  it('looks up patron by indexed externalId column', async () => {
    const result = await service.lookupCustomer('org-1', { externalId: 'qlessq-cust-99' });

    expect(customerFindFirst).toHaveBeenCalledWith({
      where: { orgId: 'org-1', externalId: 'qlessq-cust-99' },
    });
    expect(result).toEqual(
      expect.objectContaining({
        customerId: 'cust-1',
        accountId: 'acc-1',
        pointsBalance: 100,
      }),
    );
  });
});
