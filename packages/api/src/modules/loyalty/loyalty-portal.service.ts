import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyCatalogService } from './loyalty-catalog.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import {
  CURRENT_LOYALTY_PATRON_LEGAL_CONSENT_VERSION,
  CURRENT_LOYALTY_PATRON_PRIVACY_VERSION,
  CURRENT_LOYALTY_PATRON_TERMS_VERSION,
} from '@queueplatform/shared';

@Injectable()
export class LoyaltyPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
    private readonly catalog: LoyaltyCatalogService,
    private readonly requestContext: RequestContextService,
  ) {}

  private async resolveAccountByCode(referralCode: string) {
    const account = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        select: { id: true, orgId: true, customerId: true },
      }),
    );
    if (!account) return null;
    const enabled = await this.patronCrmFeature.isEnabled(account.orgId);
    return enabled ? account : null;
  }

  async getPortalByReferralCode(referralCode: string) {
    const account = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        include: {
          tier: true,
          customer: { select: { name: true, birthday: true } },
          organization: {
            select: {
              name: true,
              slug: true,
              loyaltyProgram: { select: { pointsCurrencyName: true } },
            },
          },
          badges: {
            include: { badge: { select: { id: true, name: true, description: true, icon: true } } },
            orderBy: { earnedAt: 'desc' },
          },
          challengeProgress: {
            include: {
              challenge: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  targetType: true,
                  targetValue: true,
                  rewardPoints: true,
                },
              },
            },
          },
        },
      }),
    );

    if (!account) return { found: false as const };

    const enabled = await this.patronCrmFeature.isEnabled(account.orgId);
    if (!enabled) return { found: false as const };

    const legalConsentGranted = await this.hasPatronLegalConsent(account.orgId, account.customerId);

    const [rewards, ledger] = await this.prisma.withTenant(account.orgId, async (tx) => {
      const rewardRows = await tx.loyaltyReward.findMany({
        where: { orgId: account.orgId, active: true },
        orderBy: { pointsCost: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          pointsCost: true,
          type: true,
          stock: true,
        },
      });
      const ledgerRows = await tx.loyaltyPointLedger.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          type: true,
          points: true,
          description: true,
          createdAt: true,
        },
      });
      return [rewardRows, ledgerRows] as const;
    });

    return {
      found: true as const,
      legalConsentGranted,
      patronName: account.customer.name,
      birthday: account.customer.birthday,
      orgName: account.organization.name,
      orgSlug: account.organization.slug,
      pointsCurrencyName: account.organization.loyaltyProgram?.pointsCurrencyName ?? 'Points',
      pointsBalance: account.pointsBalance,
      lifetimePointsEarned: account.lifetimePointsEarned,
      tier: account.tier,
      referralCode: account.referralCode,
      totalVisits: account.totalVisits,
      badges: account.badges.map((row) => ({
        id: row.badge.id,
        name: row.badge.name,
        description: row.badge.description,
        icon: row.badge.icon,
        earnedAt: row.earnedAt,
      })),
      challenges: account.challengeProgress.map((row) => ({
        id: row.challenge.id,
        name: row.challenge.name,
        description: row.challenge.description,
        targetType: row.challenge.targetType,
        targetValue: row.challenge.targetValue,
        rewardPoints: row.challenge.rewardPoints,
        progress: row.progress,
        completedAt: row.completedAt,
      })),
      rewards,
      recentActivity: ledger,
    };
  }

  async redeemReward(referralCode: string, rewardId: string) {
    const account = await this.resolveAccountByCode(referralCode);
    if (!account) throw new NotFoundException('Loyalty account not found');

    await this.requirePatronLegalConsent(account.orgId, account.customerId);

    const redemption = await this.catalog.redeemReward(account.orgId, account.customerId, rewardId);
    return { success: true, redemption };
  }

  async updateProfile(
    referralCode: string,
    data: { birthday?: string | null; gender?: string | null; city?: string | null },
  ) {
    const account = await this.resolveAccountByCode(referralCode);
    if (!account) throw new NotFoundException('Loyalty account not found');

    await this.requirePatronLegalConsent(account.orgId, account.customerId);

    await this.prisma.withTenant(account.orgId, (tx) =>
      tx.customer.update({
        where: { id: account.customerId },
        data: {
          birthday: data.birthday ? new Date(data.birthday) : data.birthday,
          gender: data.gender,
          city: data.city,
        },
      }),
    );
    return { success: true };
  }

  async recordPatronLegalConsent(
    referralCode: string,
    input: { termsVersion: string; privacyVersion: string },
  ) {
    if (
      input.termsVersion !== CURRENT_LOYALTY_PATRON_TERMS_VERSION ||
      input.privacyVersion !== CURRENT_LOYALTY_PATRON_PRIVACY_VERSION
    ) {
      throw new ForbiddenException(
        'Patron legal documents have been updated. Please review and accept again.',
      );
    }

    const account = await this.resolveAccountByCode(referralCode);
    if (!account) throw new NotFoundException('Loyalty account not found');

    const alreadyGranted = await this.hasPatronLegalConsent(account.orgId, account.customerId);
    if (alreadyGranted) {
      return { success: true as const, legalConsentGranted: true };
    }

    const ctx = this.requestContext.getContext();
    await this.prisma.withTenant(account.orgId, (tx) =>
      tx.consentLedgerEntry.create({
        data: {
          orgId: account.orgId,
          customerId: account.customerId,
          channel: 'legal',
          purpose: 'patron_portal',
          action: 'GRANTED',
          source: 'patron_portal',
          legalVersion: CURRENT_LOYALTY_PATRON_LEGAL_CONSENT_VERSION,
          ipAddress: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
        },
      }),
    );

    return { success: true as const, legalConsentGranted: true };
  }

  private async hasPatronLegalConsent(orgId: string, customerId: string): Promise<boolean> {
    const entry = await this.prisma.withTenant(orgId, (tx) =>
      tx.consentLedgerEntry.findFirst({
        where: {
          customerId,
          channel: 'legal',
          purpose: 'patron_portal',
          action: 'GRANTED',
          legalVersion: CURRENT_LOYALTY_PATRON_LEGAL_CONSENT_VERSION,
        },
        select: { id: true },
      }),
    );
    return entry != null;
  }

  private async requirePatronLegalConsent(orgId: string, customerId: string): Promise<void> {
    const granted = await this.hasPatronLegalConsent(orgId, customerId);
    if (!granted) {
      throw new ForbiddenException(
        'Accept the Loyalty Program Terms and Privacy Notice before continuing.',
      );
    }
  }
}
