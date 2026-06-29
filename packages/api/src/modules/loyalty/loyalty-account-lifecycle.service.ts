import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LOYALTY_ACCOUNT_CUSTOMER_SELECT } from './loyalty-account.types';

@Injectable()
export class LoyaltyAccountLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly programService: LoyaltyProgramService,
  ) {}

  async ensureAccount(orgId: string, customerId: string) {
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return null;

    await this.programService.getOrCreateProgram(orgId);

    return this.prisma.withTenant(orgId, async (tx) => {
      const existing = await tx.loyaltyAccount.findUnique({
        where: { customerId },
        include: {
          tier: true,
          wallet: true,
          customer: { select: LOYALTY_ACCOUNT_CUSTOMER_SELECT },
        },
      });
      if (existing) return existing;

      const bronzeTier = await tx.loyaltyTier.findFirst({
        where: { orgId, slug: 'bronze' },
        select: { id: true },
      });

      const referralCode = await this.programService.generateUniqueReferralCode(orgId);

      try {
        return await tx.loyaltyAccount.create({
          data: {
            orgId,
            customerId,
            tierId: bronzeTier?.id ?? null,
            referralCode,
            wallet: { create: { orgId, balanceCents: 0 } },
          },
          include: {
            tier: true,
            wallet: true,
            customer: { select: LOYALTY_ACCOUNT_CUSTOMER_SELECT },
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return tx.loyaltyAccount.findUniqueOrThrow({
            where: { customerId },
            include: {
              tier: true,
              wallet: true,
              customer: { select: LOYALTY_ACCOUNT_CUSTOMER_SELECT },
            },
          });
        }
        throw err;
      }
    });
  }

  async getAccountByCustomerId(orgId: string, customerId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.ensureAccount(orgId, customerId);
    if (!account) throw new NotFoundException('Loyalty account not found');
    return account;
  }

  async getAccountWithLedger(orgId: string, customerId: string, ledgerLimit = 20) {
    const account = await this.getAccountByCustomerId(orgId, customerId);
    const ledger = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPointLedger.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: ledgerLimit,
      }),
    );
    return { ...account, ledger };
  }

  async lookupPatronByPhone(orgId: string, phone: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) {
      throw new BadRequestException('Enter a valid phone number');
    }
    const customer = await this.prisma.withTenant(orgId, (tx) =>
      tx.customer.findFirst({
        where: {
          orgId,
          OR: [{ phone }, { phone: { contains: normalized.slice(-10) } }],
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      }),
    );
    if (!customer) return { found: false as const };
    const visitCount = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.count({ where: { orgId, customerId: customer.id } }),
    );
    const account = await this.ensureAccount(orgId, customer.id);
    return {
      found: true as const,
      customer: { ...customer, visitCount },
      loyaltyAccount: account
        ? {
            id: account.id,
            pointsBalance: account.pointsBalance,
            lifetimePointsEarned: account.lifetimePointsEarned,
            tier: account.tier,
            referralCode: account.referralCode,
          }
        : null,
    };
  }
}
