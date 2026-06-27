import { createZodDto } from 'nestjs-zod';
import {
  loyaltyIntegrationCouponRedeemSchema,
  loyaltyIntegrationEarnSchema,
  loyaltyIntegrationRedeemSchema,
  loyaltyIntegrationUpsertCustomerSchema,
  loyaltyIntegrationValidateCouponSchema,
  loyaltyIntegrationWalletAdjustSchema,
  loyaltyPortalProfileSchema,
  loyaltyPortalRedeemSchema,
  loyaltyPortalLegalConsentSchema,
  loyaltyPortalGamePlaySchema,
} from '@queueplatform/shared';

export class LoyaltyIntegrationUpsertCustomerDto extends createZodDto(
  loyaltyIntegrationUpsertCustomerSchema,
) {}
export class LoyaltyIntegrationEarnDto extends createZodDto(loyaltyIntegrationEarnSchema) {}
export class LoyaltyIntegrationRedeemDto extends createZodDto(loyaltyIntegrationRedeemSchema) {}
export class LoyaltyIntegrationValidateCouponDto extends createZodDto(
  loyaltyIntegrationValidateCouponSchema,
) {}
export class LoyaltyIntegrationCouponRedeemDto extends createZodDto(
  loyaltyIntegrationCouponRedeemSchema,
) {}
export class LoyaltyIntegrationWalletAdjustDto extends createZodDto(
  loyaltyIntegrationWalletAdjustSchema,
) {}
export class LoyaltyPortalRedeemDto extends createZodDto(loyaltyPortalRedeemSchema) {}
export class LoyaltyPortalProfileDto extends createZodDto(loyaltyPortalProfileSchema) {}
export class LoyaltyPortalLegalConsentDto extends createZodDto(loyaltyPortalLegalConsentSchema) {}
export class LoyaltyPortalGamePlayDto extends createZodDto(loyaltyPortalGamePlaySchema) {}
