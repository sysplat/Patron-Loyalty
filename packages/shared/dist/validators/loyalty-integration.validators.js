"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patronLoyaltyIntegrationConfigSchema = exports.loyaltyIntegrationQueueEventSchema = exports.loyaltyPublicReferralJoinSchema = exports.loyaltyPortalGamePlaySchema = exports.loyaltyPortalLegalConsentSchema = exports.loyaltyPortalProfileSchema = exports.loyaltyPortalRedeemSchema = exports.loyaltyIntegrationWalletAdjustSchema = exports.loyaltyIntegrationCouponRedeemSchema = exports.loyaltyIntegrationValidateCouponSchema = exports.loyaltyIntegrationRedeemSchema = exports.loyaltyIntegrationEarnSchema = exports.loyaltyIntegrationUpsertCustomerSchema = void 0;
const zod_1 = require("zod");
const loyalty_1 = require("../constants/loyalty");
const loyalty_connector_1 = require("../constants/loyalty-connector");
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
    email: zod_1.z
        .union([zod_1.z.string().email(), zod_1.z.literal('')])
        .optional()
        .nullable(),
    phone: zod_1.z.string().max(30).optional().nullable(),
});
exports.loyaltyIntegrationEarnSchema = zod_1.z
    .object({
    customerId: zod_1.z.string().uuid().optional(),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional(),
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
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional(),
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
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional(),
    phone: zod_1.z.string().max(30).optional(),
    externalId: zod_1.z.string().max(100).optional(),
})
    .superRefine(customerRefinement);
exports.loyaltyIntegrationWalletAdjustSchema = zod_1.z
    .object({
    customerId: zod_1.z.string().uuid().optional(),
    email: zod_1.z.union([zod_1.z.string().email(), zod_1.z.literal('')]).optional(),
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
exports.loyaltyPortalLegalConsentSchema = zod_1.z.object({
    termsVersion: zod_1.z.string().max(30),
    privacyVersion: zod_1.z.string().max(30),
});
exports.loyaltyPortalGamePlaySchema = zod_1.z.object({
    gameType: zod_1.z.enum(['spin_wheel', 'scratch_card']),
});
exports.loyaltyPublicReferralJoinSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(200),
    email: zod_1.z
        .union([zod_1.z.string().email(), zod_1.z.literal('')])
        .optional()
        .nullable(),
    phone: zod_1.z.string().max(30).optional().nullable(),
})
    .superRefine((data, ctx) => {
    if (!data.email?.trim() && !data.phone?.trim()) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Email or phone is required',
            path: ['email'],
        });
    }
});
exports.loyaltyIntegrationQueueEventSchema = zod_1.z
    .object({
    event: zod_1.z.enum(loyalty_connector_1.QLESSQ_QUEUE_INTEGRATION_EVENT_VALUES),
    sourceId: zod_1.z.string().min(1).max(100),
    branchId: zod_1.z.string().uuid().optional(),
    serviceId: zod_1.z.string().uuid().optional().nullable(),
    customerId: zod_1.z.string().uuid().optional(),
    customer: zod_1.z
        .object({
        externalId: zod_1.z.string().min(1).max(100),
        name: zod_1.z.string().min(1).max(200).optional(),
        email: zod_1.z
            .union([zod_1.z.string().email(), zod_1.z.literal('')])
            .optional()
            .nullable(),
        phone: zod_1.z.string().max(30).optional().nullable(),
    })
        .optional(),
    customerPhone: zod_1.z.string().max(30).optional().nullable(),
    customerEmail: zod_1.z
        .union([zod_1.z.string().email(), zod_1.z.literal('')])
        .optional()
        .nullable(),
    rating: zod_1.z.number().int().min(1).max(5).optional(),
    occurredAt: zod_1.z.string().datetime().optional(),
    connectorVersion: zod_1.z.number().int().min(1).max(99).optional().default(1),
})
    .superRefine((data, ctx) => {
    const needsCustomer = [
        'ticket.completed',
        'appointment.completed',
        'review.submitted',
        'customer.created',
    ].includes(data.event);
    if (!needsCustomer)
        return;
    const hasCustomer = data.customerId ||
        data.customer?.externalId ||
        data.customerPhone ||
        data.customerEmail ||
        data.customer?.email ||
        data.customer?.phone;
    if (!hasCustomer) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Provide customerId or customer contact fields',
            path: ['customer'],
        });
    }
});
exports.patronLoyaltyIntegrationConfigSchema = zod_1.z.object({
    lmsOrgId: zod_1.z.string().uuid().optional(),
    apiBaseUrl: zod_1.z.string().url().max(500).optional(),
    apiKey: zod_1.z.string().min(16).max(200),
});
//# sourceMappingURL=loyalty-integration.validators.js.map