"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loyaltyAddonCheckoutSchema = exports.billingPortalSchema = exports.subscriptionCheckoutSchema = exports.smsCreditCheckoutSchema = exports.changePlanSchema = void 0;
const zod_1 = require("zod");
exports.changePlanSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid(),
});
exports.smsCreditCheckoutSchema = zod_1.z.object({
    packSlug: zod_1.z.string().min(1).max(50),
    successUrl: zod_1.z.string().url(),
    cancelUrl: zod_1.z.string().url(),
});
exports.subscriptionCheckoutSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid(),
    successUrl: zod_1.z.string().url(),
    cancelUrl: zod_1.z.string().url(),
    billingInterval: zod_1.z.enum(['monthly', 'yearly']).optional(),
});
exports.billingPortalSchema = zod_1.z.object({
    returnUrl: zod_1.z.string().url(),
});
exports.loyaltyAddonCheckoutSchema = zod_1.z.object({
    successUrl: zod_1.z.string().url(),
    cancelUrl: zod_1.z.string().url(),
    billingInterval: zod_1.z.enum(['monthly', 'yearly']).optional(),
});
//# sourceMappingURL=billing.validators.js.map