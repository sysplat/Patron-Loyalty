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
    const walletId = account.wallet.id;

    return this.prisma.withTenant(orgId, async (tx) => {
      let balanceAfter: number;

      if (isDebit) {
        const debited = await tx.loyaltyWallet.updateMany({
          where: { id: walletId, orgId, balanceCents: { gte: amountCents } },
          data: { balanceCents: { decrement: amountCents } },
        });
        if (debited.count === 0) {
          throw new BadRequestException('Insufficient wallet balance');
        }
        const wallet = await tx.loyaltyWallet.findUniqueOrThrow({ where: { id: walletId } });
        balanceAfter = wallet.balanceCents;
      } else {
        const wallet = await tx.loyaltyWallet.update({
          where: { id: walletId },
          data: { balanceCents: { increment: amountCents } },
        });
        balanceAfter = wallet.balanceCents;
      }

      const delta = isDebit ? -amountCents : amountCents;
      await tx.loyaltyWalletTransaction.create({
        data: {
          orgId,
          walletId,
          type,
          amountCents: delta,
          balanceAfter,
          description: description ?? null,
          sourceType: 'manual',
        },
      });
      return tx.loyaltyWallet.findUniqueOrThrow({ where: { id: walletId } });
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
