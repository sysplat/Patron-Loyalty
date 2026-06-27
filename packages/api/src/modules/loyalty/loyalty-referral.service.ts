import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LOYALTY_EARN_EVENT_TYPES } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LoyaltyIntegrationService } from './loyalty-integration.service';

@Injectable()
export class LoyaltyReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
    private readonly programService: LoyaltyProgramService,
    private readonly integration: LoyaltyIntegrationService,
  ) {}

  async applyReferral(orgId: string, referralCode: string, referredCustomerId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const program = await this.programService.getOrCreateProgram(orgId);

    const referrer = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findFirst({
        where: { orgId, referralCode: referralCode.toUpperCase() },
        include: { customer: true },
      }),
    );
    if (!referrer) throw new NotFoundException('Referral code not found');
    if (referrer.customerId === referredCustomerId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    const referredAccount = await this.accounts.ensureAccount(orgId, referredCustomerId);
    if (!referredAccount) throw new BadRequestException('Could not create loyalty account');

    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyReferral.findFirst({ where: { referredCustomerId } }),
    );
    if (existing) throw new BadRequestException('Customer already has a referral');

    const referral = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyReferral.create({
        data: {
          orgId,
          referrerAccountId: referrer.id,
          referredCustomerId,
          referredAccountId: referredAccount.id,
          status: 'completed',
          referrerBonusPoints: program.referralBonusPoints,
          referredBonusPoints: program.referredBonusPoints,
          completedAt: new Date(),
        },
      }),
    );

    await this.accounts.earnFromEvent(
      orgId,
      referrer.customerId,
      LOYALTY_EARN_EVENT_TYPES.REFERRAL_COMPLETED,
      { sourceType: 'referral', sourceId: referral.id, description: 'Referral bonus' },
    );
    await this.accounts.earnFromEvent(
      orgId,
      referredCustomerId,
      LOYALTY_EARN_EVENT_TYPES.REFERRAL_COMPLETED,
      { sourceType: 'referral', sourceId: referral.id, description: 'Welcome referral bonus' },
    );

    return referral;
  }

  async listReferrals(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyReferral.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          referrerAccount: { include: { customer: { select: { name: true, email: true } } } },
        },
      }),
    );
  }

  async getReferralStats(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const [total, completed, bonusPoints] = await this.prisma.withTenant(orgId, async (tx) => {
      const all = await tx.loyaltyReferral.count({ where: { orgId } });
      const done = await tx.loyaltyReferral.count({ where: { orgId, status: 'completed' } });
      const agg = await tx.loyaltyReferral.aggregate({
        where: { orgId, status: 'completed' },
        _sum: { referrerBonusPoints: true, referredBonusPoints: true },
      });
      return [all, done, (agg._sum.referrerBonusPoints ?? 0) + (agg._sum.referredBonusPoints ?? 0)];
    });
    return { total, completed, bonusPointsAwarded: bonusPoints };
  }

  async getPublicReferralLanding(referralCode: string) {
    const referrer = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        include: {
          customer: { select: { name: true } },
          organization: {
            select: {
              name: true,
              slug: true,
              loyaltyProgram: {
                select: { referredBonusPoints: true, referralBonusPoints: true },
              },
            },
          },
        },
      }),
    );
    if (!referrer) return { found: false as const };

    const enabled = await this.patronCrmFeature.isEnabled(referrer.orgId);
    if (!enabled) return { found: false as const };

    const program = referrer.organization.loyaltyProgram;
    const firstName = referrer.customer.name.trim().split(/\s+/)[0] ?? referrer.customer.name;

    return {
      found: true as const,
      orgName: referrer.organization.name,
      orgSlug: referrer.organization.slug,
      referrerFirstName: firstName,
      referralCode: referrer.referralCode,
      referredBonusPoints: program?.referredBonusPoints ?? 25,
      referrerBonusPoints: program?.referralBonusPoints ?? 50,
    };
  }

  async joinViaPublicReferral(
    referralCode: string,
    data: { name: string; email?: string | null; phone?: string | null },
  ) {
    const landing = await this.getPublicReferralLanding(referralCode);
    if (!landing.found) throw new NotFoundException('Referral code not found');

    const referrer = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        select: { orgId: true, customerId: true },
      }),
    );
    if (!referrer) throw new NotFoundException('Referral code not found');

    const upsert = await this.integration.upsertCustomer(referrer.orgId, {
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
    });

    if (upsert.customerId === referrer.customerId) {
      throw new BadRequestException('Cannot join using your own referral code');
    }

    const existingReferral = await this.prisma.withTenant(referrer.orgId, (tx) =>
      tx.loyaltyReferral.findFirst({ where: { referredCustomerId: upsert.customerId } }),
    );

    if (!existingReferral && upsert.created) {
      await this.applyReferral(referrer.orgId, referralCode, upsert.customerId);
    }

    const account = await this.prisma.withTenant(referrer.orgId, (tx) =>
      tx.loyaltyAccount.findUnique({
        where: { customerId: upsert.customerId },
        select: { referralCode: true, pointsBalance: true },
      }),
    );

    return {
      joined: true,
      referralApplied: !existingReferral && upsert.created,
      portalCode: account?.referralCode ?? null,
      pointsBalance: account?.pointsBalance ?? 0,
    };
  }
}
