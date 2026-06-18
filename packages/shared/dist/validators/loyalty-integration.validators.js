"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loyaltyPortalProfileSchema = exports.loyaltyPortalRedeemSchema = exports.loyaltyIntegrationWalletAdjustSchema = exports.loyaltyIntegrationCouponRedeemSchema = exports.loyaltyIntegrationValidateCouponSchema = exports.loyaltyIntegrationRedeemSchema = exports.loyaltyIntegrationEarnSchema = exports.loyaltyIntegrationUpsertCustomerSchema = void 0;
const zod_1 = require("zod");
const loyalty_1 = require("../constants/loyalty");
const customerRefinement = (data, ctx) => {
    if (!data.customerId && !data.email && !data.phone && !data.externalId) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Provide customerId, email, phone, or externalId',
        });
    }
};
exports.loyaltyIntegrationUpsertCustomerSchema = zod_1.z.object({
    externalId: zod_1.z.string().max(100).optional(),
    name: zod_1.z.string().min(1).max(200),
    email: zod_1.z.string().email().optional().nullable(),
    phone: zod_1.z.string().max(30).optional().nullable(),
});
exports.loyaltyIntegrationEarnSchema = zod_1.z
    .object({
    customerId: zod_1.z.string().uuid().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(30).optional(),
    externalId: zod_1.z.string().max(100).optional(),
    points: zod_1.z.number().int().min(1).max(1_000_000).optional(),
    purchaseAmountCents: zod_1.z.number().int().min(1).max(100_000_000).optional(),
    eventType: zod_1.z
        .enum([loyalty_1.LOYALTY_EARN_EVENT_TYPES.PURCHASE, loyalty_1.LOYALTY_EARN_EVENT_TYPES.MANUAL])
        .default(loyalty_1.LOYALTY_EARN_EVENT_TYPES.PURCHASE),
    externalTxnId: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
})
    .superRefine(customerRefinement)
    .superRefine((data, ctx) => {
    if (!data.points && !data.purchaseAmountCents) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Provide points or purchaseAmountCents',
            path: ['points'],
        });
    }
});
exports.loyaltyIntegrationRedeemSchema = zod_1.z
    .object({
    customerId: zod_1.z.string().uuid().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(30).optional(),
    externalId: zod_1.z.string().max(100).optional(),
    rewardId: zod_1.z.string().uuid(),
    externalTxnId: zod_1.z.string().min(1).max(100).optional(),
})
    .superRefine(customerRefinement);
exports.loyaltyIntegrationValidateCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(2).max(50),
    accountId: zod_1.z.string().uuid().optional(),
    customerId: zod_1.z.string().uuid().optional(),
});
exports.loyaltyIntegrationCouponRedeemSchema = zod_1.z
    .object({
    code: zod_1.z.string().min(2).max(50),
    customerId: zod_1.z.string().uuid().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(30).optional(),
    externalId: zod_1.z.string().max(100).optional(),
})
    .superRefine(customerRefinement);
exports.loyaltyIntegrationWalletAdjustSchema = zod_1.z
    .object({
    customerId: zod_1.z.string().uuid().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().max(30).optional(),
    externalId: zod_1.z.string().max(100).optional(),
    type: zod_1.z.enum(['CREDIT', 'DEBIT', 'REFUND', 'CASHBACK', 'BONUS', 'GIFT']),
    amountCents: zod_1.z.number().int().min(1).max(10_000_000),
    description: zod_1.z.string().max(500).optional(),
})
    .superRefine(customerRefinement);
exports.loyaltyPortalRedeemSchema = zod_1.z.object({
    rewardId: zod_1.z.string().uuid(),
});
exports.loyaltyPortalProfileSchema = zod_1.z.object({
    birthday: zod_1.z.string().date().optional().nullable(),
    gender: zod_1.z.string().max(20).optional().nullable(),
    city: zod_1.z.string().max(100).optional().nullable(),
});
//# sourceMappingURL=loyalty-integration.validators.js.map