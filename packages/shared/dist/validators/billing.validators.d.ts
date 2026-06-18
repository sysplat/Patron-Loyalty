import { z } from 'zod';
export declare const changePlanSchema: z.ZodObject<{
    planId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    planId: string;
}, {
    planId: string;
}>;
export declare const smsCreditCheckoutSchema: z.ZodObject<{
    packSlug: z.ZodString;
    successUrl: z.ZodString;
    cancelUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    packSlug: string;
    successUrl: string;
    cancelUrl: string;
}, {
    packSlug: string;
    successUrl: string;
    cancelUrl: string;
}>;
export declare const subscriptionCheckoutSchema: z.ZodObject<{
    planId: z.ZodString;
    successUrl: z.ZodString;
    cancelUrl: z.ZodString;
    billingInterval: z.ZodOptional<z.ZodEnum<["monthly", "yearly"]>>;
}, "strip", z.ZodTypeAny, {
    planId: string;
    successUrl: string;
    cancelUrl: string;
    billingInterval?: "monthly" | "yearly" | undefined;
}, {
    planId: string;
    successUrl: string;
    cancelUrl: string;
    billingInterval?: "monthly" | "yearly" | undefined;
}>;
export declare const billingPortalSchema: z.ZodObject<{
    returnUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    returnUrl: string;
}, {
    returnUrl: string;
}>;
export declare const loyaltyAddonCheckoutSchema: z.ZodObject<{
    successUrl: z.ZodString;
    cancelUrl: z.ZodString;
    billingInterval: z.ZodOptional<z.ZodEnum<["monthly", "yearly"]>>;
}, "strip", z.ZodTypeAny, {
    successUrl: string;
    cancelUrl: string;
    billingInterval?: "monthly" | "yearly" | undefined;
}, {
    successUrl: string;
    cancelUrl: string;
    billingInterval?: "monthly" | "yearly" | undefined;
}>;
//# sourceMappingURL=billing.validators.d.ts.map