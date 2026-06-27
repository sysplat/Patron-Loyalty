import { createZodDto } from 'nestjs-zod';
import {
  createCrmTaskSchema,
  createCrmSupportTicketSchema,
  createCrmSalesOpportunitySchema,
  createGiftCardSchema,
  createLoyaltyBadgeSchema,
  createLoyaltyCampaignSchema,
  createLoyaltyChallengeSchema,
  createLoyaltyCouponSchema,
  createLoyaltyEarnRuleSchema,
  createLoyaltyRewardSchema,
  createLoyaltyTierSchema,
  createReferralSchema,
  loyaltyPointsAdjustSchema,
  loyaltyWalletAdjustSchema,
  redeemLoyaltyRewardSchema,
  updateCrmTaskSchema,
  updateCrmSupportTicketSchema,
  updateCrmSalesOpportunitySchema,
  updateLoyaltyCampaignSchema,
  updateLoyaltyProfileSchema,
  updateLoyaltyEarnRuleSchema,
  updateLoyaltyProgramSchema,
  updateLoyaltyRewardSchema,
  validateLoyaltyCouponSchema,
} from '@queueplatform/shared';

export class UpdateLoyaltyProgramDto extends createZodDto(updateLoyaltyProgramSchema) {}
export class CreateLoyaltyTierDto extends createZodDto(createLoyaltyTierSchema) {}
export class CreateLoyaltyEarnRuleDto extends createZodDto(createLoyaltyEarnRuleSchema) {}
export class UpdateLoyaltyEarnRuleDto extends createZodDto(updateLoyaltyEarnRuleSchema) {}
export class CreateLoyaltyRewardDto extends createZodDto(createLoyaltyRewardSchema) {}
export class UpdateLoyaltyRewardDto extends createZodDto(updateLoyaltyRewardSchema) {}
export class RedeemLoyaltyRewardDto extends createZodDto(redeemLoyaltyRewardSchema) {}
export class CreateLoyaltyCouponDto extends createZodDto(createLoyaltyCouponSchema) {}
export class ValidateLoyaltyCouponDto extends createZodDto(validateLoyaltyCouponSchema) {}
export class LoyaltyWalletAdjustDto extends createZodDto(loyaltyWalletAdjustSchema) {}
export class LoyaltyPointsAdjustDto extends createZodDto(loyaltyPointsAdjustSchema) {}
export class CreateReferralDto extends createZodDto(createReferralSchema) {}
export class CreateLoyaltyCampaignDto extends createZodDto(createLoyaltyCampaignSchema) {}
export class UpdateLoyaltyCampaignDto extends createZodDto(updateLoyaltyCampaignSchema) {}
export class CreateLoyaltyBadgeDto extends createZodDto(createLoyaltyBadgeSchema) {}
export class CreateLoyaltyChallengeDto extends createZodDto(createLoyaltyChallengeSchema) {}
export class CreateGiftCardDto extends createZodDto(createGiftCardSchema) {}
export class CreateCrmTaskDto extends createZodDto(createCrmTaskSchema) {}
export class UpdateCrmTaskDto extends createZodDto(updateCrmTaskSchema) {}
export class CreateCrmSupportTicketDto extends createZodDto(createCrmSupportTicketSchema) {}
export class UpdateCrmSupportTicketDto extends createZodDto(updateCrmSupportTicketSchema) {}
export class CreateCrmSalesOpportunityDto extends createZodDto(createCrmSalesOpportunitySchema) {}
export class UpdateCrmSalesOpportunityDto extends createZodDto(updateCrmSalesOpportunitySchema) {}
export class UpdateLoyaltyProfileDto extends createZodDto(updateLoyaltyProfileSchema) {}
