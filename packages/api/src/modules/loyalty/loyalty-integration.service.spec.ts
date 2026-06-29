import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
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

  it('resolves patron by email when externalId missing', async () => {
    customerFindFirst.mockImplementation((args: { where: Record<string, unknown> }) => {
      if (args.where.email) {
        return Promise.resolve({
          id: 'cust-email',
          name: 'Email Patron',
          email: 'patron@example.com',
          phone: null,
        });
      }
      return Promise.resolve(null);
    });
    accounts.ensureAccount.mockResolvedValue({
      id: 'acc-2',
      pointsBalance: 50,
      referralCode: 'REF2',
    });

    const result = await service.lookupCustomer('org-1', { email: 'patron@example.com' });
    expect(result).toMatchObject({ customerId: 'cust-email', pointsBalance: 50 });
  });

  it('falls back to metadata externalId scan', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'cust-meta' }]);
    const update = vi.fn().mockResolvedValue({});
    customerFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'cust-meta',
      name: 'Meta Patron',
      email: null,
      phone: null,
      externalId: null,
    });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ customer: { findFirst: customerFindFirst, update }, $queryRaw: queryRaw }),
    );
    accounts.ensureAccount.mockResolvedValue({
      id: 'acc-meta',
      pointsBalance: 10,
      referralCode: null,
    });

    const result = await service.lookupCustomer('org-1', { externalId: 'legacy-ext' });
    expect(queryRaw).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cust-meta' },
      data: { externalId: 'legacy-ext' },
    });
    expect(result).toMatchObject({ customerId: 'cust-meta' });
  });

  it('skips metadata scan when legacy lookup disabled', async () => {
    const queryRaw = vi.fn();
    vi.stubEnv('LOYALTY_CONNECTOR_LEGACY_METADATA_EXTERNAL_ID_LOOKUP', 'false');
    customerFindFirst.mockResolvedValue(null);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ customer: { findFirst: customerFindFirst }, $queryRaw: queryRaw }),
    );

    await expect(
      service.lookupCustomer('org-1', { externalId: 'legacy-ext' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queryRaw).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe('LoyaltyIntegrationService upsertCustomer', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const customers = {
    create: vi.fn().mockResolvedValue({ id: 'cust-new', name: 'New Patron' }),
  };
  const accounts = { ensureAccount: vi.fn().mockResolvedValue({ id: 'acct-1' }) };
  const catalog = {};
  const program = {};
  const wallet = {};
  let service: LoyaltyIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ customer: { update: vi.fn().mockResolvedValue({}) } }),
    );
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

  it('creates new customer when no match exists', async () => {
    vi.spyOn(service, 'resolveCustomer' as never).mockResolvedValue(null as never);

    const result = await service.upsertCustomer('org-1', {
      externalId: 'ext-new',
      name: 'New Patron',
      email: 'new@example.com',
    });

    expect(customers.create).toHaveBeenCalled();
    expect(result).toMatchObject({ customerId: 'cust-new', created: true, accountId: 'acct-1' });
  });

  it('updates existing customer on upsert match', async () => {
    vi.spyOn(service, 'resolveCustomer' as never).mockResolvedValue({
      id: 'cust-existing',
      metadata: {},
    } as never);

    const result = await service.upsertCustomer('org-1', {
      externalId: 'ext-1',
      name: 'Updated Name',
    });

    expect(result).toMatchObject({ customerId: 'cust-existing', created: false });
    expect(customers.create).not.toHaveBeenCalled();
  });
});

describe('LoyaltyIntegrationService connector routes', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const customers = {};
  const accounts = {
    ensureAccount: vi.fn().mockResolvedValue({ id: 'acc-1', pointsBalance: 100 }),
    getAccountByCustomerId: vi.fn().mockResolvedValue({ id: 'acc-1' }),
    earnIntegrationPoints: vi.fn(),
  };
  const catalog = {
    redeemReward: vi.fn().mockResolvedValue({ id: 'red-1' }),
    validateCoupon: vi.fn().mockResolvedValue({ valid: true }),
    redeemCoupon: vi.fn().mockResolvedValue({ ok: true }),
  };
  const program = { resolveEarnPoints: vi.fn() };
  const wallet = { adjustWallet: vi.fn().mockResolvedValue({ balanceCents: 5000 }) };
  let service: LoyaltyIntegrationService;
  const customer = { id: 'cust-1', name: 'Patron', email: 'p@x.com', phone: '+1' };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyPointLedger: { findFirst: vi.fn().mockResolvedValue(null) },
        customer: { findFirst: vi.fn().mockResolvedValue(customer) },
      }),
    );
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

  it('redeems reward for resolved patron', async () => {
    vi.spyOn(service, 'resolveCustomerOrThrow' as never).mockResolvedValue(customer as never);

    const result = await service.redeemReward('org-1', {
      customerId: 'cust-1',
      rewardId: 'reward-1',
    });

    expect(catalog.redeemReward).toHaveBeenCalledWith('org-1', 'cust-1', 'reward-1');
    expect(result).toMatchObject({ customerId: 'cust-1', redemption: { id: 'red-1' } });
  });

  it('validates coupon using customer account', async () => {
    await service.validateCoupon('org-1', { code: 'SAVE10', customerId: 'cust-1' });
    expect(accounts.getAccountByCustomerId).toHaveBeenCalledWith('org-1', 'cust-1');
    expect(catalog.validateCoupon).toHaveBeenCalledWith('org-1', 'SAVE10', 'acc-1');
  });

  it('redeems coupon for patron account', async () => {
    vi.spyOn(service, 'resolveCustomerOrThrow' as never).mockResolvedValue(customer as never);

    await service.redeemCoupon('org-1', { code: 'SAVE10', externalId: 'ext-1' });
    expect(catalog.redeemCoupon).toHaveBeenCalledWith('org-1', 'SAVE10', 'acc-1');
  });

  it('adjusts wallet for resolved patron', async () => {
    vi.spyOn(service, 'resolveCustomerOrThrow' as never).mockResolvedValue(customer as never);

    const result = await service.adjustWallet('org-1', {
      customerId: 'cust-1',
      type: 'CREDIT',
      amountCents: 500,
      description: 'POS',
    });

    expect(wallet.adjustWallet).toHaveBeenCalledWith('org-1', 'cust-1', 'CREDIT', 500, 'POS');
    expect(result).toMatchObject({ balanceCents: 5000 });
  });

  it('throws when earn cannot resolve points', async () => {
    vi.spyOn(service, 'resolveCustomerOrThrow' as never).mockResolvedValue(customer as never);
    accounts.ensureAccount.mockResolvedValue({
      id: 'acc-1',
      tier: null,
      lifetimePointsEarned: 0,
    });

    await expect(
      service.earnPoints('org-1', {
        customerId: 'cust-1',
        eventType: LOYALTY_EARN_EVENT_TYPES.MANUAL,
        externalTxnId: 'txn-bad',
      }),
    ).rejects.toThrow('Could not resolve points');
  });
});
