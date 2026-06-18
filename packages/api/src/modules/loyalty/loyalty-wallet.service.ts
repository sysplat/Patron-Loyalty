import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from './loyalty-account.service';

@Injectable()
export class LoyaltyWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
  ) {}

  async getWallet(orgId: string, customerId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.accounts.ensureAccount(orgId, customerId);
    if (!account?.wallet) throw new NotFoundException('Wallet not found');
    const transactions = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyWalletTransaction.findMany({
        where: { walletId: account.wallet!.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    );
    return { ...account.wallet, transactions };
  }

  async adjustWallet(
    orgId: string,
    customerId: string,
    type: string,
    amountCents: number,
    description?: string,
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.accounts.ensureAccount(orgId, customerId);
    if (!account?.wallet) throw new NotFoundException('Wallet not found');

    const isDebit = type === 'DEBIT';
    if (isDebit && account.wallet.balanceCents < amountCents) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const delta = isDebit ? -amountCents : amountCents;
    const balanceAfter = account.wallet.balanceCents + delta;

    return this.prisma.withTenant(orgId, async (tx) => {
      await tx.loyaltyWallet.update({
        where: { id: account.wallet!.id },
        data: { balanceCents: balanceAfter },
      });
      await tx.loyaltyWalletTransaction.create({
        data: {
          orgId,
          walletId: account.wallet!.id,
          type,
          amountCents: delta,
          balanceAfter,
          description: description ?? null,
          sourceType: 'manual',
        },
      });
      return tx.loyaltyWallet.findUniqueOrThrow({ where: { id: account.wallet!.id } });
    });
  }

  async createGiftCard(
    orgId: string,
    data: {
      initialBalanceCents: number;
      recipientEmail?: string | null;
      expiresAt?: Date | null;
      purchaserCustomerId?: string;
    },
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);
    let purchaserAccountId: string | null = null;
    if (data.purchaserCustomerId) {
      const account = await this.accounts.ensureAccount(orgId, data.purchaserCustomerId);
      purchaserAccountId = account?.id ?? null;
    }

    const code = `GC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyGiftCard.create({
        data: {
          orgId,
          code,
          initialBalanceCents: data.initialBalanceCents,
          balanceCents: data.initialBalanceCents,
          recipientEmail: data.recipientEmail ?? null,
          expiresAt: data.expiresAt ?? null,
          purchaserAccountId,
        },
      }),
    );
  }

  async listGiftCards(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyGiftCard.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    );
  }
}
