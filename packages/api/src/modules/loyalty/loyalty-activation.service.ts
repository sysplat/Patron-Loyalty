import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  hasLoyaltyProduct,
  hasQueueProduct,
  LOYALTY_PLAN_SLUG,
  PRODUCT_SKUS,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductEntitlementService } from '../../common/features/product-entitlement.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { BillingService } from '../billing/billing.service';
import { LoyaltyProgramService } from './loyalty-program.service';

const LOYALTY_TRIAL_SETTING_KEY = 'loyalty_trial_started_at';

@Injectable()
export class LoyaltyActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly entitlements: ProductEntitlementService,
    private readonly billing: BillingService,
    private readonly program: LoyaltyProgramService,
  ) {}

  async getStatus(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { productSku: true, patronCrmEnabled: true, name: true },
    });

    const hasLoyalty = hasLoyaltyProduct(org.productSku, org.patronCrmEnabled);
    const trialSetting = await this.prisma.withTenant(orgId, (tx) =>
      tx.setting.findFirst({
        where: { orgId, key: LOYALTY_TRIAL_SETTING_KEY, scope: 'org' },
        select: { value: true },
      }),
    );
    const trialUsed = Boolean(trialSetting?.value);

    const loyaltyPlan = await this.prisma.plan.findUnique({
      where: { slug: LOYALTY_PLAN_SLUG },
      select: {
        id: true,
        name: true,
        slug: true,
        priceMonthly: true,
        priceYearly: true,
      },
    });

    const canActivateTrial = !hasLoyalty && org.productSku !== PRODUCT_SKUS.LOYALTY && !trialUsed;

    return {
      organizationName: org.name,
      productSku: org.productSku,
      hasLoyaltyProduct: hasLoyalty,
      hasQueueProduct: hasQueueProduct(org.productSku),
      canActivateTrial,
      trialUsed,
      loyaltyPlan: loyaltyPlan ?? null,
      checkoutAvailable: Boolean(loyaltyPlan),
    };
  }

  async startTrial(orgId: string, actorUserId?: string) {
    const status = await this.getStatus(orgId);
    if (status.hasLoyaltyProduct) {
      throw new BadRequestException('Patron Loyalty is already active for this organization.');
    }
    if (!status.canActivateTrial) {
      throw new BadRequestException(
        'A loyalty trial is not available for this organization. Subscribe or contact support.',
      );
    }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await this.prisma.withTenant(orgId, async (tx) => {
      const existing = await tx.setting.findFirst({
        where: { orgId, key: LOYALTY_TRIAL_SETTING_KEY, scope: 'org' },
      });
      if (existing) {
        throw new BadRequestException('Loyalty trial was already started for this organization.');
      }
      await tx.setting.create({
        data: {
          orgId,
          key: LOYALTY_TRIAL_SETTING_KEY,
          scope: 'org',
          value: { startedAt: new Date().toISOString(), endsAt: trialEndsAt.toISOString() },
        },
      });
    });

    const entitlement = await this.entitlements.enableLoyalty(orgId, 'trial');
    await this.program.getOrCreateProgram(orgId);
    await this.patronCrmFeature.invalidateCache(orgId);

    return {
      ...entitlement,
      trialEndsAt: trialEndsAt.toISOString(),
      activatedByUserId: actorUserId ?? null,
    };
  }

  async createCheckoutSession(
    orgId: string,
    successUrl: string,
    cancelUrl: string,
    billingInterval: 'monthly' | 'yearly' = 'monthly',
    actorUserId?: string,
  ) {
    const status = await this.getStatus(orgId);
    if (status.hasLoyaltyProduct) {
      throw new BadRequestException('Patron Loyalty is already active for this organization.');
    }
    if (!status.loyaltyPlan) {
      throw new NotFoundException('Loyalty plan is not configured on this server.');
    }

    return this.billing.createLoyaltyAddonCheckoutSession(
      orgId,
      status.loyaltyPlan.id,
      successUrl,
      cancelUrl,
      billingInterval,
      actorUserId,
    );
  }
}
