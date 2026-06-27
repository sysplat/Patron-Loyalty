import { z } from 'zod';
import {
  LOYALTY_CAMPAIGN_CHANNELS,
  LOYALTY_CAMPAIGN_TRIGGERS,
  LOYALTY_CAMPAIGN_STATUSES,
  LOYALTY_COUPON_TYPES,
  LOYALTY_EARN_EVENT_TYPES,
  LOYALTY_REWARD_TYPES,
  LOYALTY_WALLET_TX_TYPES,
  CRM_TASK_STATUSES,
  CRM_SUPPORT_TICKET_PRIORITIES,
  CRM_SUPPORT_TICKET_STATUSES,
  CRM_SALES_STAGES,
} from '../constants/loyalty';

const optionalDate = z.string().datetime().optional().nullable();

export const updateLoyaltyProgramSchema = z.object({
  enabled: z.boolean().optional(),
  pointsCurrencyName: z.string().min(1).max(50).optional(),
  displayCurrencyCode: z.string().length(3).optional(),
  defaultLocale: z.string().min(2).max(10).optional(),
  defaultEarnPoints: z.number().int().min(0).max(100000).optional(),
  referralBonusPoints: z.number().int().min(0).max(100000).optional(),
  referredBonusPoints: z.number().int().min(0).max(100000).optional(),
  pointsExpiryDays: z.number().int().min(1).max(3650).nullable().optional(),
});

export const createLoyaltyTierSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z
    .string()
    .min(1)
    .max(30)
    .regex(/^[a-z0-9-]+$/),
  minLifetimePoints: z.number().int().min(0),
  sortOrder: z.number().int().min(0).optional(),
  color: z.string().max(20).optional().nullable(),
  benefits: z.record(z.unknown()).optional(),
});

export const updateLoyaltyTierSchema = createLoyaltyTierSchema.partial();

export const createLoyaltyEarnRuleSchema = z.object({
  name: z.string().min(1).max(100),
  eventType: z.enum([
    LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
    LOYALTY_EARN_EVENT_TYPES.APPOINTMENT_COMPLETED,
    LOYALTY_EARN_EVENT_TYPES.REVIEW_SUBMITTED,
    LOYALTY_EARN_EVENT_TYPES.REFERRAL_COMPLETED,
    LOYALTY_EARN_EVENT_TYPES.PURCHASE,
    LOYALTY_EARN_EVENT_TYPES.MANUAL,
  ]),
  points: z.number().int().min(0).max(100000),
  active: z.boolean().optional(),
  conditions: z.record(z.unknown()).optional(),
});

export const createLoyaltyRewardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  type: z.enum([
    LOYALTY_REWARD_TYPES.DISCOUNT,
    LOYALTY_REWARD_TYPES.FREE_ITEM,
    LOYALTY_REWARD_TYPES.GIFT,
    LOYALTY_REWARD_TYPES.SERVICE,
  ]),
  pointsCost: z.number().int().min(1).max(1000000),
  stock: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  validFrom: optionalDate,
  validUntil: optionalDate,
  imageUrl: z.string().url().max(500).optional().nullable(),
});

export const updateLoyaltyRewardSchema = createLoyaltyRewardSchema.partial();

export const redeemLoyaltyRewardSchema = z.object({
  customerId: z.string().uuid(),
  rewardId: z.string().uuid(),
});

export const createLoyaltyCouponSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i),
  name: z.string().min(1).max(100),
  type: z.enum([
    LOYALTY_COUPON_TYPES.PERCENT,
    LOYALTY_COUPON_TYPES.FIXED,
    LOYALTY_COUPON_TYPES.BOGO,
  ]),
  value: z.number().int().min(1),
  minPurchaseCents: z.number().int().min(0).nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  active: z.boolean().optional(),
  validFrom: optionalDate,
  validUntil: optionalDate,
  tierSlugs: z.array(z.string()).optional(),
});

export const validateLoyaltyCouponSchema = z.object({
  code: z.string().min(2).max(50),
  accountId: z.string().uuid().optional(),
});

export const loyaltyWalletAdjustSchema = z.object({
  type: z.enum([
    LOYALTY_WALLET_TX_TYPES.CREDIT,
    LOYALTY_WALLET_TX_TYPES.DEBIT,
    LOYALTY_WALLET_TX_TYPES.REFUND,
    LOYALTY_WALLET_TX_TYPES.CASHBACK,
    LOYALTY_WALLET_TX_TYPES.BONUS,
    LOYALTY_WALLET_TX_TYPES.GIFT,
  ]),
  amountCents: z.number().int().min(1),
  description: z.string().max(500).optional(),
});

export const loyaltyPointsAdjustSchema = z.object({
  points: z
    .number()
    .int()
    .refine((n) => n !== 0, 'Points must be non-zero'),
  description: z.string().max(500).optional(),
});

export const createReferralSchema = z.object({
  referralCode: z.string().min(4).max(20),
  customerId: z.string().uuid(),
});

export const createLoyaltyCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum([
    LOYALTY_CAMPAIGN_CHANNELS.SMS,
    LOYALTY_CAMPAIGN_CHANNELS.EMAIL,
    LOYALTY_CAMPAIGN_CHANNELS.PUSH,
    LOYALTY_CAMPAIGN_CHANNELS.WHATSAPP,
    LOYALTY_CAMPAIGN_CHANNELS.IN_APP,
  ]),
  trigger: z.enum([
    LOYALTY_CAMPAIGN_TRIGGERS.WELCOME,
    LOYALTY_CAMPAIGN_TRIGGERS.BIRTHDAY,
    LOYALTY_CAMPAIGN_TRIGGERS.WIN_BACK,
    LOYALTY_CAMPAIGN_TRIGGERS.TIER_UPGRADE,
    LOYALTY_CAMPAIGN_TRIGGERS.ABANDONED,
    LOYALTY_CAMPAIGN_TRIGGERS.MANUAL,
  ]),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().max(10000).optional().nullable(),
  segmentPreset: z.string().max(50).optional().nullable(),
  scheduledAt: optionalDate,
});

export const updateLoyaltyCampaignSchema = createLoyaltyCampaignSchema.partial().extend({
  status: z
    .enum([
      LOYALTY_CAMPAIGN_STATUSES.DRAFT,
      LOYALTY_CAMPAIGN_STATUSES.SCHEDULED,
      LOYALTY_CAMPAIGN_STATUSES.ACTIVE,
      LOYALTY_CAMPAIGN_STATUSES.PAUSED,
      LOYALTY_CAMPAIGN_STATUSES.COMPLETED,
    ])
    .optional(),
});

export const updateLoyaltyEarnRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  points: z.number().int().min(0).max(100000).optional(),
  active: z.boolean().optional(),
  conditions: z.record(z.unknown()).optional(),
});

export const createCrmSupportTicketSchema = z.object({
  customerId: z.string().uuid(),
  subject: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  priority: z
    .enum([
      CRM_SUPPORT_TICKET_PRIORITIES.LOW,
      CRM_SUPPORT_TICKET_PRIORITIES.NORMAL,
      CRM_SUPPORT_TICKET_PRIORITIES.HIGH,
      CRM_SUPPORT_TICKET_PRIORITIES.URGENT,
    ])
    .optional(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const updateCrmSupportTicketSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  priority: z
    .enum([
      CRM_SUPPORT_TICKET_PRIORITIES.LOW,
      CRM_SUPPORT_TICKET_PRIORITIES.NORMAL,
      CRM_SUPPORT_TICKET_PRIORITIES.HIGH,
      CRM_SUPPORT_TICKET_PRIORITIES.URGENT,
    ])
    .optional(),
  status: z
    .enum([
      CRM_SUPPORT_TICKET_STATUSES.OPEN,
      CRM_SUPPORT_TICKET_STATUSES.PENDING,
      CRM_SUPPORT_TICKET_STATUSES.RESOLVED,
      CRM_SUPPORT_TICKET_STATUSES.CLOSED,
    ])
    .optional(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const createCrmSalesOpportunitySchema = z.object({
  customerId: z.string().uuid(),
  title: z.string().min(1).max(200),
  stage: z
    .enum([
      CRM_SALES_STAGES.LEAD,
      CRM_SALES_STAGES.QUALIFIED,
      CRM_SALES_STAGES.PROPOSAL,
      CRM_SALES_STAGES.NEGOTIATION,
      CRM_SALES_STAGES.WON,
      CRM_SALES_STAGES.LOST,
    ])
    .optional(),
  valueCents: z.number().int().min(0).optional(),
  expectedCloseDate: optionalDate,
  notes: z.string().max(5000).optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const updateCrmSalesOpportunitySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  stage: z
    .enum([
      CRM_SALES_STAGES.LEAD,
      CRM_SALES_STAGES.QUALIFIED,
      CRM_SALES_STAGES.PROPOSAL,
      CRM_SALES_STAGES.NEGOTIATION,
      CRM_SALES_STAGES.WON,
      CRM_SALES_STAGES.LOST,
    ])
    .optional(),
  valueCents: z.number().int().min(0).optional(),
  expectedCloseDate: optionalDate,
  notes: z.string().max(5000).optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const createLoyaltyBadgeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  criteria: z.record(z.unknown()).optional(),
});

export const createLoyaltyChallengeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  targetType: z.enum(['VISITS', 'POINTS_EARNED', 'REFERRALS']),
  targetValue: z.number().int().min(1),
  rewardPoints: z.number().int().min(0).optional(),
  startAt: optionalDate,
  endAt: optionalDate,
});

export const createGiftCardSchema = z.object({
  initialBalanceCents: z.number().int().min(100),
  recipientEmail: z.string().email().optional().nullable(),
  expiresAt: optionalDate,
});

export const createCrmTaskSchema = z.object({
  customerId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  dueAt: optionalDate,
  assigneeId: z.string().uuid().optional().nullable(),
});

export const updateCrmTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z
    .enum([
      CRM_TASK_STATUSES.OPEN,
      CRM_TASK_STATUSES.IN_PROGRESS,
      CRM_TASK_STATUSES.DONE,
      CRM_TASK_STATUSES.CANCELLED,
    ])
    .optional(),
  dueAt: optionalDate,
  assigneeId: z.string().uuid().optional().nullable(),
});

export const updateLoyaltyProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  birthday: z.string().date().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  addressLine1: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
});
