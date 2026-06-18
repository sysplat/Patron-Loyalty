import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LOYALTY_EARN_EVENT_TYPES, type LoyaltyEarnEventType } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerService } from '../customer/customer.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyCatalogService } from './loyalty-catalog.service';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LoyaltyWalletService } from './loyalty-wallet.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { mergeCustomerMetadata, parseCustomerMetadata } from '../customer/customer-contact.util';

@Injectable()
export class LoyaltyIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerService,
    private readonly accounts: LoyaltyAccountService,
    private readonly catalog: LoyaltyCatalogService,
    private readonly program: LoyaltyProgramService,
    private readonly wallet: LoyaltyWalletService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  async upsertCustomer(
    orgId: string,
    data: {
      externalId?: string;
      name: string;
      email?: string | null;
      phone?: string | null;
    },
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);

    const email = data.email?.trim() || null;
    const phone = data.phone?.trim() || null;
    const externalId = data.externalId?.trim();

    const existing = await this.resolveCustomer(orgId, {
      email: email ?? undefined,
      phone: phone ?? undefined,
      externalId,
    });

    if (existing) {
      if (externalId) {
        const parsed = parseCustomerMetadata(existing.metadata);
        const merged = mergeCustomerMetadata(existing.metadata, {
          externalId,
          tags: parsed.tags,
          notes: parsed.notes,
        });
        await this.prisma.withTenant(orgId, (tx) =>
          tx.customer.update({
            where: { id: existing.id },
            data: { metadata: merged as Prisma.InputJsonValue, name: data.name.trim() },
          }),
        );
      }
      const account = await this.accounts.ensureAccount(orgId, existing.id);
      return { customerId: existing.id, accountId: account?.id ?? null, created: false };
    }

    const created = await this.customers.create(orgId, {
      name: data.name,
      email: email ?? undefined,
      phone: phone ?? undefined,
    });

    if (externalId) {
      const merged = mergeCustomerMetadata(null, { externalId, tags: [], notes: '' });
      await this.prisma.withTenant(orgId, (tx) =>
        tx.customer.update({
          where: { id: created.id },
          data: { metadata: merged as Prisma.InputJsonValue },
        }),
      );
    }

    const account = await this.accounts.ensureAccount(orgId, created.id);
    return { customerId: created.id, accountId: account?.id ?? null, created: true };
  }

  async earnPoints(
    orgId: string,
    data: {
      customerId?: string;
      email?: string;
      phone?: string;
      externalId?: string;
      points?: number;
      purchaseAmountCents?: number;
      eventType: LoyaltyEarnEventType;
      externalTxnId: string;
      description?: string;
    },
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);

    const duplicate = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPointLedger.findFirst({
        where: {
          orgId,
          sourceType: 'integration',
          sourceId: data.externalTxnId,
        },
        select: { id: true, accountId: true, points: true },
      }),
    );
    if (duplicate) {
      return {
        idempotent: true,
        accountId: duplicate.accountId,
        points: duplicate.points,
      };
    }

    const customer = await this.resolveCustomerOrThrow(orgId, data);
    const account = await this.accounts.ensureAccount(orgId, customer.id);
    if (!account) throw new NotFoundException('Loyalty account not found');

    let points = data.points;
    if (!points && data.purchaseAmountCents) {
      const rate = await this.program.resolveEarnPoints(orgId, LOYALTY_EARN_EVENT_TYPES.PURCHASE);
      const dollars = data.purchaseAmountCents / 100;
      points = Math.max(1, Math.floor(dollars * Math.max(rate, 1)));
    }
    if (!points || points <= 0) {
      throw new BadRequestException('Could not resolve points for transaction');
    }

    const updated = await this.accounts.earnIntegrationPoints(orgId, account.id, points, {
      sourceId: data.externalTxnId,
      description: data.description ?? `Integration earn (${data.eventType})`,
      incrementVisit: data.eventType === LOYALTY_EARN_EVENT_TYPES.PURCHASE,
    });

    return {
      idempotent: false,
      accountId: updated.id,
      customerId: customer.id,
      pointsBalance: updated.pointsBalance,
      pointsEarned: points,
    };
  }

  async redeemReward(
    orgId: string,
    data: {
      customerId?: string;
      email?: string;
      phone?: string;
      externalId?: string;
      rewardId: string;
    },
  ) {
    const customer = await this.resolveCustomerOrThrow(orgId, data);
    const redemption = await this.catalog.redeemReward(orgId, customer.id, data.rewardId);
    return { customerId: customer.id, redemption };
  }

  async validateCoupon(
    orgId: string,
    data: { code: string; accountId?: string; customerId?: string },
  ) {
    let accountId = data.accountId;
    if (!accountId && data.customerId) {
      const account = await this.accounts.getAccountByCustomerId(orgId, data.customerId);
      accountId = account.id;
    }
    return this.catalog.validateCoupon(orgId, data.code, accountId);
  }

  async lookupCustomer(
    orgId: string,
    ref: { customerId?: string; email?: string; phone?: string; externalId?: string },
  ) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const customer = await this.resolveCustomer(orgId, ref);
    if (!customer) throw new NotFoundException('Patron not found');
    const account = await this.accounts.ensureAccount(orgId, customer.id);
    return {
      customerId: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      accountId: account?.id ?? null,
      pointsBalance: account?.pointsBalance ?? 0,
      referralCode: account?.referralCode ?? null,
    };
  }

  async redeemCoupon(
    orgId: string,
    data: {
      code: string;
      customerId?: string;
      email?: string;
      phone?: string;
      externalId?: string;
    },
  ) {
    const customer = await this.resolveCustomerOrThrow(orgId, data);
    const account = await this.accounts.ensureAccount(orgId, customer.id);
    if (!account) throw new NotFoundException('Loyalty account not found');
    return this.catalog.redeemCoupon(orgId, data.code, account.id);
  }

  async adjustWallet(
    orgId: string,
    data: {
      customerId?: string;
      email?: string;
      phone?: string;
      externalId?: string;
      type: string;
      amountCents: number;
      description?: string;
    },
  ) {
    const customer = await this.resolveCustomerOrThrow(orgId, data);
    return this.wallet.adjustWallet(
      orgId,
      customer.id,
      data.type,
      data.amountCents,
      data.description,
    );
  }

  private async resolveCustomerOrThrow(
    orgId: string,
    ref: {
      customerId?: string;
      email?: string;
      phone?: string;
      externalId?: string;
    },
  ) {
    const customer = await this.resolveCustomer(orgId, ref);
    if (!customer) throw new NotFoundException('Patron not found');
    return customer;
  }

  private async resolveCustomer(
    orgId: string,
    ref: {
      customerId?: string;
      email?: string;
      phone?: string;
      externalId?: string;
    },
  ) {
    return this.prisma.withTenant(orgId, async (tx) => {
      if (ref.customerId) {
        return tx.customer.findFirst({ where: { id: ref.customerId, orgId } });
      }
      if (ref.email) {
        const found = await tx.customer.findFirst({ where: { orgId, email: ref.email.trim() } });
        if (found) return found;
      }
      if (ref.phone) {
        const found = await tx.customer.findFirst({ where: { orgId, phone: ref.phone.trim() } });
        if (found) return found;
      }
      if (ref.externalId) {
        const rows = await tx.customer.findMany({
          where: { orgId },
          select: { id: true, metadata: true, name: true, email: true, phone: true },
          take: 5000,
        });
        return (
          rows.find((row) => {
            const meta = parseCustomerMetadata(row.metadata);
            return meta.externalId === ref.externalId;
          }) ?? null
        );
      }
      return null;
    });
  }
}
