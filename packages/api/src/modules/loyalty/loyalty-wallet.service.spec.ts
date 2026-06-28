import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
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
