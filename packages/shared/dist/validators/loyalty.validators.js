"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLoyaltyProfileSchema = exports.updateCrmTaskSchema = exports.createCrmTaskSchema = exports.createGiftCardSchema = exports.createLoyaltyChallengeSchema = exports.createLoyaltyBadgeSchema = exports.updateLoyaltyEarnRuleSchema = exports.updateLoyaltyCampaignSchema = exports.createLoyaltyCampaignSchema = exports.createReferralSchema = exports.loyaltyPointsAdjustSchema = exports.loyaltyWalletAdjustSchema = exports.validateLoyaltyCouponSchema = exports.createLoyaltyCouponSchema = exports.redeemLoyaltyRewardSchema = exports.updateLoyaltyRewardSchema = exports.createLoyaltyRewardSchema = exports.createLoyaltyEarnRuleSchema = exports.updateLoyaltyTierSchema = exports.createLoyaltyTierSchema = exports.updateLoyaltyProgramSchema = void 0;
const zod_1 = require("zod");
const loyalty_1 = require("../constants/loyalty");
const optionalDate = zod_1.z.string().datetime().optional().nullable();
exports.updateLoyaltyProgramSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    pointsCurrencyName: zod_1.z.string().min(1).max(50).optional(),
    defaultEarnPoints: zod_1.z.number().int().min(0).max(100000).optional(),
    referralBonusPoints: zod_1.z.number().int().min(0).max(100000).optional(),
    referredBonusPoints: zod_1.z.number().int().min(0).max(100000).optional(),
    pointsExpiryDays: zod_1.z.number().int().min(1).max(3650).nullable().optional(),
});
exports.createLoyaltyTierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50),
    slug: zod_1.z
        .string()
        .min(1)
        .max(30)
        .regex(/^[a-z0-9-]+$/),
    minLifetimePoints: zod_1.z.number().int().min(0),
    sortOrder: zod_1.z.number().int().min(0).optional(),
    color: zod_1.z.string().max(20).optional().nullable(),
    benefits: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.updateLoyaltyTierSchema = exports.createLoyaltyTierSchema.partial();
exports.createLoyaltyEarnRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    eventType: zod_1.z.enum([
        loyalty_1.LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
        loyalty_1.LOYALTY_EARN_EVENT_TYPES.APPOINTMENT_COMPLETED,
        loyalty_1.LOYALTY_EARN_EVENT_TYPES.REVIEW_SUBMITTED,
        loyalty_1.LOYALTY_EARN_EVENT_TYPES.REFERRAL_COMPLETED,
        loyalty_1.LOYALTY_EARN_EVENT_TYPES.PURCHASE,
        loyalty_1.LOYALTY_EARN_EVENT_TYPES.MANUAL,
    ]),
    points: zod_1.z.number().int().min(0).max(100000),
    active: zod_1.z.boolean().optional(),
    conditions: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.createLoyaltyRewardSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional().nullable(),
    type: zod_1.z.enum([
        loyalty_1.LOYALTY_REWARD_TYPES.DISCOUNT,
        loyalty_1.LOYALTY_REWARD_TYPES.FREE_ITEM,
        loyalty_1.LOYALTY_REWARD_TYPES.GIFT,
        loyalty_1.LOYALTY_REWARD_TYPES.SERVICE,
    ]),
    pointsCost: zod_1.z.number().int().min(1).max(1000000),
    stock: zod_1.z.number().int().min(0).nullable().optional(),
    active: zod_1.z.boolean().optional(),
    validFrom: optionalDate,
    validUntil: optionalDate,
    imageUrl: zod_1.z.string().url().max(500).optional().nullable(),
});
exports.updateLoyaltyRewardSchema = exports.createLoyaltyRewardSchema.partial();
exports.redeemLoyaltyRewardSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid(),
    rewardId: zod_1.z.string().uuid(),
});
exports.createLoyaltyCouponSchema = zod_1.z.object({
    code: zod_1.z
        .string()
        .min(2)
        .max(50)
        .regex(/^[A-Z0-9_-]+$/i),
    name: zod_1.z.string().min(1).max(100),
    type: zod_1.z.enum([
        loyalty_1.LOYALTY_COUPON_TYPES.PERCENT,
        loyalty_1.LOYALTY_COUPON_TYPES.FIXED,
        loyalty_1.LOYALTY_COUPON_TYPES.BOGO,
    ]),
    value: zod_1.z.number().int().min(1),
    minPurchaseCents: zod_1.z.number().int().min(0).nullable().optional(),
    maxUses: zod_1.z.number().int().min(1).nullable().optional(),
    active: zod_1.z.boolean().optional(),
    validFrom: optionalDate,
    validUntil: optionalDate,
    tierSlugs: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.validateLoyaltyCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(2).max(50),
    accountId: zod_1.z.string().uuid().optional(),
});
exports.loyaltyWalletAdjustSchema = zod_1.z.object({
    type: zod_1.z.enum([
        loyalty_1.LOYALTY_WALLET_TX_TYPES.CREDIT,
        loyalty_1.LOYALTY_WALLET_TX_TYPES.DEBIT,
        loyalty_1.LOYALTY_WALLET_TX_TYPES.REFUND,
        loyalty_1.LOYALTY_WALLET_TX_TYPES.CASHBACK,
        loyalty_1.LOYALTY_WALLET_TX_TYPES.BONUS,
        loyalty_1.LOYALTY_WALLET_TX_TYPES.GIFT,
    ]),
    amountCents: zod_1.z.number().int().min(1),
    description: zod_1.z.string().max(500).optional(),
});
exports.loyaltyPointsAdjustSchema = zod_1.z.object({
    points: zod_1.z
        .number()
        .int()
        .refine((n) => n !== 0, 'Points must be non-zero'),
    description: zod_1.z.string().max(500).optional(),
});
exports.createReferralSchema = zod_1.z.object({
    referralCode: zod_1.z.string().min(4).max(20),
    customerId: zod_1.z.string().uuid(),
});
exports.createLoyaltyCampaignSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    channel: zod_1.z.enum([
        loyalty_1.LOYALTY_CAMPAIGN_CHANNELS.SMS,
        loyalty_1.LOYALTY_CAMPAIGN_CHANNELS.EMAIL,
        loyalty_1.LOYALTY_CAMPAIGN_CHANNELS.PUSH,
        loyalty_1.LOYALTY_CAMPAIGN_CHANNELS.WHATSAPP,
        loyalty_1.LOYALTY_CAMPAIGN_CHANNELS.IN_APP,
    ]),
    trigger: zod_1.z.enum([
        loyalty_1.LOYALTY_CAMPAIGN_TRIGGERS.WELCOME,
        loyalty_1.LOYALTY_CAMPAIGN_TRIGGERS.BIRTHDAY,
        loyalty_1.LOYALTY_CAMPAIGN_TRIGGERS.WIN_BACK,
        loyalty_1.LOYALTY_CAMPAIGN_TRIGGERS.TIER_UPGRADE,
        loyalty_1.LOYALTY_CAMPAIGN_TRIGGERS.ABANDONED,
        loyalty_1.LOYALTY_CAMPAIGN_TRIGGERS.MANUAL,
    ]),
    subject: zod_1.z.string().max(200).optional().nullable(),
    body: zod_1.z.string().max(10000).optional().nullable(),
    segmentPreset: zod_1.z.string().max(50).optional().nullable(),
    scheduledAt: optionalDate,
});
exports.updateLoyaltyCampaignSchema = exports.createLoyaltyCampaignSchema.partial().extend({
    status: zod_1.z
        .enum([
        loyalty_1.LOYALTY_CAMPAIGN_STATUSES.DRAFT,
        loyalty_1.LOYALTY_CAMPAIGN_STATUSES.SCHEDULED,
        loyalty_1.LOYALTY_CAMPAIGN_STATUSES.ACTIVE,
        loyalty_1.LOYALTY_CAMPAIGN_STATUSES.PAUSED,
        loyalty_1.LOYALTY_CAMPAIGN_STATUSES.COMPLETED,
    ])
        .optional(),
});
exports.updateLoyaltyEarnRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    points: zod_1.z.number().int().min(0).max(100000).optional(),
    active: zod_1.z.boolean().optional(),
});
exports.createLoyaltyBadgeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional().nullable(),
    icon: zod_1.z.string().max(50).optional().nullable(),
    criteria: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.createLoyaltyChallengeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional().nullable(),
    targetType: zod_1.z.enum(['VISITS', 'POINTS_EARNED', 'REFERRALS']),
    targetValue: zod_1.z.number().int().min(1),
    rewardPoints: zod_1.z.number().int().min(0).optional(),
    startAt: optionalDate,
    endAt: optionalDate,
});
exports.createGiftCardSchema = zod_1.z.object({
    initialBalanceCents: zod_1.z.number().int().min(100),
    recipientEmail: zod_1.z.string().email().optional().nullable(),
    expiresAt: optionalDate,
});
exports.createCrmTaskSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().max(5000).optional().nullable(),
    dueAt: optionalDate,
    assigneeId: zod_1.z.string().uuid().optional().nullable(),
});
exports.updateCrmTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(5000).optional().nullable(),
    status: zod_1.z
        .enum([
        loyalty_1.CRM_TASK_STATUSES.OPEN,
        loyalty_1.CRM_TASK_STATUSES.IN_PROGRESS,
        loyalty_1.CRM_TASK_STATUSES.DONE,
        loyalty_1.CRM_TASK_STATUSES.CANCELLED,
    ])
        .optional(),
    dueAt: optionalDate,
    assigneeId: zod_1.z.string().uuid().optional().nullable(),
});
exports.updateLoyaltyProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    email: zod_1.z.string().email().max(255).optional().nullable(),
    phone: zod_1.z.string().max(20).optional().nullable(),
    birthday: zod_1.z.string().date().optional().nullable(),
    gender: zod_1.z.string().max(20).optional().nullable(),
    addressLine1: zod_1.z.string().max(255).optional().nullable(),
    city: zod_1.z.string().max(100).optional().nullable(),
    region: zod_1.z.string().max(100).optional().nullable(),
    postalCode: zod_1.z.string().max(20).optional().nullable(),
    country: zod_1.z.string().length(2).optional().nullable(),
});
//# sourceMappingURL=loyalty.validators.js.map