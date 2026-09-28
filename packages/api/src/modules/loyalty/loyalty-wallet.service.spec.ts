import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LoyaltyWalletService } from './loyalty-wallet.service';

describe('LoyaltyWalletService adjustWallet', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = {
    ensureAccount: vi.fn(),
  };

  const walletUpdateMany = vi.fn();
  const walletUpdate = vi.fn();
  const walletFindUniqueOrThrow = vi.fn();
  const walletTransactionCreate = vi.fn();

  let service: LoyaltyWalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    accounts.ensureAccount.mockResolvedValue({
      id: 'acc-1',
      wallet: { id: 'wallet-1', balanceCents: 5000 },
    });
    walletUpdateMany.mockResolvedValue({ count: 1 });
    walletUpdate.mockResolvedValue({ id: 'wallet-1', balanceCents: 6000 });
    walletFindUniqueOrThrow.mockResolvedValue({ id: 'wallet-1', balanceCents: 4000 });
    walletTransactionCreate.mockResolvedValue({ id: 'tx-1' });

    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyWallet: {
          updateMany: walletUpdateMany,
          update: walletUpdate,
          findUniqueOrThrow: walletFindUniqueOrThrow,
        },
        loyaltyWalletTransaction: { create: walletTransactionCreate },
      }),
    );

    service = new LoyaltyWalletService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
    );
  });

  it('debits with atomic balance guard inside the transaction', async () => {
    const result = await service.adjustWallet('org-1', 'cust-1', 'DEBIT', 1000);

    expect(walletUpdateMany).toHaveBeenCalledWith({
      where: { id: 'wallet-1', orgId: 'org-1', balanceCents: { gte: 1000 } },
      data: { balanceCents: { decrement: 1000 } },
    });
    expect(walletTransactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletId: 'wallet-1',
        type: 'DEBIT',
        amountCents: -1000,
        balanceAfter: 4000,
      }),
    });
    expect(result.balanceCents).toBe(4000);
  });

  it('throws when debit would overdraw (updateMany count 0)', async () => {
    walletUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.adjustWallet('org-1', 'cust-1', 'DEBIT', 1000)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(walletTransactionCreate).not.toHaveBeenCalled();
  });

  it('credits without pre-checking balance outside the transaction', async () => {
    walletFindUniqueOrThrow.mockResolvedValue({ id: 'wallet-1', balanceCents: 6000 });

    await service.adjustWallet('org-1', 'cust-1', 'CREDIT', 1000);

    expect(walletUpdateMany).not.toHaveBeenCalled();
    expect(walletUpdate).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balanceCents: { increment: 1000 } },
    });
  });
});

describe('LoyaltyWalletService getWallet and gift cards', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  const accounts = { ensureAccount: vi.fn() };
  let service: LoyaltyWalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyWalletService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
    );
  });

  it('returns wallet with recent transactions', async () => {
    accounts.ensureAccount.mockResolvedValue({
      id: 'acc-1',
      wallet: { id: 'wallet-1', balanceCents: 2500 },
    });
    const findMany = vi.fn().mockResolvedValue([{ id: 'tx-1' }]);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyWalletTransaction: { findMany } }),
    );

    const wallet = await service.getWallet('org-1', 'cust-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { walletId: 'wallet-1' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    expect(wallet).toMatchObject({
      id: 'wallet-1',
      balanceCents: 2500,
      transactions: [{ id: 'tx-1' }],
    });
  });

  it('creates a wallet when the loyalty account has none', async () => {
    accounts.ensureAccount.mockResolvedValue({ id: 'acc-1', wallet: null });
    const create = vi.fn().mockResolvedValue({ id: 'wallet-new', balanceCents: 0 });
    const findMany = vi.fn().mockResolvedValue([]);
    prisma.withTenant
      .mockImplementationOnce((_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({ loyaltyWallet: { create } }),
      )
      .mockImplementationOnce((_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({ loyaltyWalletTransaction: { findMany } }),
      );

    const wallet = await service.getWallet('org-1', 'cust-1');

    expect(create).toHaveBeenCalledWith({
      data: { orgId: 'org-1', accountId: 'acc-1', balanceCents: 0 },
    });
    expect(wallet).toMatchObject({
      id: 'wallet-new',
      balanceCents: 0,
      transactions: [],
    });
  });

  it('recovers when concurrent wallet create hits unique constraint', async () => {
    accounts.ensureAccount.mockResolvedValue({ id: 'acc-1', wallet: null });
    const create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: 'wallet-race', balanceCents: 0 });
    const findMany = vi.fn().mockResolvedValue([]);
    prisma.withTenant
      .mockImplementationOnce((_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({ loyaltyWallet: { create } }),
      )
      .mockImplementationOnce((_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({ loyaltyWallet: { findUniqueOrThrow } }),
      )
      .mockImplementationOnce((_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({ loyaltyWalletTransaction: { findMany } }),
      );

    const wallet = await service.getWallet('org-1', 'cust-1');

    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { accountId: 'acc-1' } });
    expect(wallet).toMatchObject({ id: 'wallet-race', transactions: [] });
  });

  it('creates gift card with purchaser account when provided', async () => {
    accounts.ensureAccount.mockResolvedValue({ id: 'acc-buyer' });
    const create = vi.fn().mockResolvedValue({ id: 'gc-1', code: 'GC-TEST' });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyGiftCard: { create } }),
    );

    const card = await service.createGiftCard('org-1', {
      initialBalanceCents: 5000,
      recipientEmail: 'gift@example.com',
      purchaserCustomerId: 'cust-buyer',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: 'org-1',
        initialBalanceCents: 5000,
        balanceCents: 5000,
        recipientEmail: 'gift@example.com',
        purchaserAccountId: 'acc-buyer',
      }),
    });
    expect(card).toEqual({ id: 'gc-1', code: 'GC-TEST' });
  });

  it('lists gift cards for org', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'gc-1' }]);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyGiftCard: { findMany } }),
    );

    const cards = await service.listGiftCards('org-1');

    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' }, take: 100 });
    expect(cards).toEqual([{ id: 'gc-1' }]);
  });

  it('deletes gift card for org', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyGiftCard: { deleteMany } }),
    );

    await expect(service.deleteGiftCard('org-1', 'gc-1')).resolves.toEqual({ deleted: true });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'gc-1', orgId: 'org-1' } });
  });

  it('throws when gift card to delete is missing', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyGiftCard: { deleteMany } }),
    );

    await expect(service.deleteGiftCard('org-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
