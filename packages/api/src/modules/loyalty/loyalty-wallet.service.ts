import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  /** Ensure a wallet row exists for the account (legacy accounts may lack one). */
  private async ensureWallet(
    orgId: string,
    account: { id: string; wallet: { id: string; balanceCents: number; currency?: string } | null },
  ) {
    if (account.wallet) return account.wallet;

    try {
      return await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyWallet.create({
          data: { orgId, accountId: account.id, balanceCents: 0 },
        }),
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyWallet.findUniqueOrThrow({ where: { accountId: account.id } }),
        );
      }
      throw err;
    }
  }

  async getWallet(orgId: string, customerId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.accounts.ensureAccount(orgId, customerId);
    if (!account) throw new NotFoundException('Loyalty account not found');

    const wallet = await this.ensureWallet(orgId, account);

    const transactions = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyWalletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    );
    return { ...wallet, transactions };
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
    if (!account) throw new NotFoundException('Loyalty account not found');

    const wallet = await this.ensureWallet(orgId, account);
    const isDebit = type === 'DEBIT';
    const walletId = wallet.id;

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

  async deleteGiftCard(orgId: string, giftCardId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const deleted = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyGiftCard.deleteMany({ where: { id: giftCardId, orgId } }),
    );
    if (deleted.count === 0) throw new NotFoundException('Gift card not found');
    return { deleted: true as const };
  }
}
