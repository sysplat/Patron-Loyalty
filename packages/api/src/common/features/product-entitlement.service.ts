import { Injectable } from '@nestjs/common';
import { PRODUCT_SKUS, type ProductSku } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from './patron-crm-feature.service';

export type LoyaltyEntitlementSource = 'trial' | 'subscription' | 'plan' | 'registration' | 'admin';

/**
 * Applies Patron Loyalty / CRM entitlements when a customer purchases or trials LMS,
 * without requiring platform-operator toggles.
 */
@Injectable()
export class ProductEntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  resolveProductSkuAfterLoyalty(currentSku: string): ProductSku {
    if (currentSku === PRODUCT_SKUS.LOYALTY || currentSku === PRODUCT_SKUS.BUNDLE) {
      return currentSku as ProductSku;
    }
    return PRODUCT_SKUS.BUNDLE;
  }

  async enableLoyalty(
    orgId: string,
    _source: LoyaltyEntitlementSource,
  ): Promise<{ productSku: string; patronCrmEnabled: boolean }> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { productSku: true, patronCrmEnabled: true },
    });

    const productSku = this.resolveProductSkuAfterLoyalty(org.productSku);
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        patronCrmEnabled: true,
        productSku,
      },
      select: { productSku: true, patronCrmEnabled: true },
    });

    await this.patronCrmFeature.invalidateCache(orgId);

    return updated;
  }

  async syncLoyaltyFromPlanLimits(
    orgId: string,
    limits: Record<string, unknown> | null | undefined,
  ): Promise<void> {
    if (limits?.hasCrmIntegration !== true) return;
    await this.enableLoyalty(orgId, 'plan');
  }
}
