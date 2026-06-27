import { z } from 'zod';
export declare const loyaltyIntegrationUpsertCustomerSchema: z.ZodObject<{
    externalId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    externalId?: string | undefined;
}, {
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    externalId?: string | undefined;
}>;
export declare const loyaltyIntegrationEarnSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    customerId: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    externalId: z.ZodOptional<z.ZodString>;
    points: z.ZodOptional<z.ZodNumber>;
    purchaseAmountCents: z.ZodOptional<z.ZodNumber>;
    eventType: z.ZodDefault<z.ZodEnum<["PURCHASE", "MANUAL"]>>;
    externalTxnId: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    eventType: "PURCHASE" | "MANUAL";
    externalTxnId: string;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    points?: number | undefined;
    externalId?: string | undefined;
    purchaseAmountCents?: number | undefined;
}, {
    externalTxnId: string;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    eventType?: "PURCHASE" | "MANUAL" | undefined;
    points?: number | undefined;
    externalId?: string | undefined;
    purchaseAmountCents?: number | undefined;
}>, {
    eventType: "PURCHASE" | "MANUAL";
    externalTxnId: string;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    points?: number | undefined;
    externalId?: string | undefined;
    purchaseAmountCents?: number | undefined;
}, {
    externalTxnId: string;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    eventType?: "PURCHASE" | "MANUAL" | undefined;
    points?: number | undefined;
    externalId?: string | undefined;
    purchaseAmountCents?: number | undefined;
}>, {
    eventType: "PURCHASE" | "MANUAL";
    externalTxnId: string;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    points?: number | undefined;
    externalId?: string | undefined;
    purchaseAmountCents?: number | undefined;
}, {
    externalTxnId: string;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    eventType?: "PURCHASE" | "MANUAL" | undefined;
    points?: number | undefined;
    externalId?: string | undefined;
    purchaseAmountCents?: number | undefined;
}>;
export declare const loyaltyIntegrationRedeemSchema: z.ZodEffects<z.ZodObject<{
    customerId: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    externalId: z.ZodOptional<z.ZodString>;
    rewardId: z.ZodString;
    externalTxnId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    rewardId: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
    externalTxnId?: string | undefined;
}, {
    rewardId: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
    externalTxnId?: string | undefined;
}>, {
    rewardId: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
    externalTxnId?: string | undefined;
}, {
    rewardId: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
    externalTxnId?: string | undefined;
}>;
export declare const loyaltyIntegrationValidateCouponSchema: z.ZodObject<{
    code: z.ZodString;
    accountId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    customerId?: string | undefined;
    accountId?: string | undefined;
}, {
    code: string;
    customerId?: string | undefined;
    accountId?: string | undefined;
}>;
export declare const loyaltyIntegrationCouponRedeemSchema: z.ZodEffects<z.ZodObject<{
    code: z.ZodString;
    customerId: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    externalId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
}, {
    code: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
}>, {
    code: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
}, {
    code: string;
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
}>;
export declare const loyaltyIntegrationWalletAdjustSchema: z.ZodEffects<z.ZodObject<{
    customerId: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    externalId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["CREDIT", "DEBIT", "REFUND", "CASHBACK", "BONUS", "GIFT"]>;
    amountCents: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "BONUS" | "GIFT" | "CREDIT" | "DEBIT" | "REFUND" | "CASHBACK";
    amountCents: number;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
}, {
    type: "BONUS" | "GIFT" | "CREDIT" | "DEBIT" | "REFUND" | "CASHBACK";
    amountCents: number;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
}>, {
    type: "BONUS" | "GIFT" | "CREDIT" | "DEBIT" | "REFUND" | "CASHBACK";
    amountCents: number;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
}, {
    type: "BONUS" | "GIFT" | "CREDIT" | "DEBIT" | "REFUND" | "CASHBACK";
    amountCents: number;
    email?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    customerId?: string | undefined;
    externalId?: string | undefined;
}>;
export declare const loyaltyPortalRedeemSchema: z.ZodObject<{
    rewardId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    rewardId: string;
}, {
    rewardId: string;
}>;
export declare const loyaltyPortalProfileSchema: z.ZodObject<{
    birthday: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    gender: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    city: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    birthday?: string | null | undefined;
    gender?: string | null | undefined;
    city?: string | null | undefined;
}, {
    birthday?: string | null | undefined;
    gender?: string | null | undefined;
    city?: string | null | undefined;
}>;
export declare const loyaltyPortalLegalConsentSchema: z.ZodObject<{
    termsVersion: z.ZodString;
    privacyVersion: z.ZodString;
}, "strip", z.ZodTypeAny, {
    termsVersion: string;
    privacyVersion: string;
}, {
    termsVersion: string;
    privacyVersion: string;
}>;
export declare const loyaltyPublicReferralJoinSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
}, {
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
}>, {
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
}, {
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
}>;
export declare const loyaltyIntegrationQueueEventSchema: z.ZodEffects<z.ZodObject<{
    event: z.ZodEnum<[import("../constants/loyalty-connector").QlessqQueueIntegrationEvent, ...import("../constants/loyalty-connector").QlessqQueueIntegrationEvent[]]>;
    sourceId: z.ZodString;
    branchId: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodString>;
    customer: z.ZodOptional<z.ZodObject<{
        externalId: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        externalId: string;
        email?: string | null | undefined;
        name?: string | undefined;
        phone?: string | null | undefined;
    }, {
        externalId: string;
        email?: string | null | undefined;
        name?: string | undefined;
        phone?: string | null | undefined;
    }>>;
    customerPhone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    customerEmail: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rating: z.ZodOptional<z.ZodNumber>;
    occurredAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    event: import("../constants/loyalty-connector").QlessqQueueIntegrationEvent;
    sourceId: string;
    customer?: {
        externalId: string;
        email?: string | null | undefined;
        name?: string | undefined;
        phone?: string | null | undefined;
    } | undefined;
    branchId?: string | undefined;
    serviceId?: string | null | undefined;
    customerId?: string | undefined;
    customerPhone?: string | null | undefined;
    customerEmail?: string | null | undefined;
    rating?: number | undefined;
    occurredAt?: string | undefined;
}, {
    event: import("../constants/loyalty-connector").QlessqQueueIntegrationEvent;
    sourceId: string;
    customer?: {
        externalId: string;
        email?: string | null | undefined;
        name?: string | undefined;
        phone?: string | null | undefined;
    } | undefined;
    branchId?: string | undefined;
    serviceId?: string | null | undefined;
    customerId?: string | undefined;
    customerPhone?: string | null | undefined;
    customerEmail?: string | null | undefined;
    rating?: number | undefined;
    occurredAt?: string | undefined;
}>, {
    event: import("../constants/loyalty-connector").QlessqQueueIntegrationEvent;
    sourceId: string;
    customer?: {
        externalId: string;
        email?: string | null | undefined;
        name?: string | undefined;
        phone?: string | null | undefined;
    } | undefined;
    branchId?: string | undefined;
    serviceId?: string | null | undefined;
    customerId?: string | undefined;
    customerPhone?: string | null | undefined;
    customerEmail?: string | null | undefined;
    rating?: number | undefined;
    occurredAt?: string | undefined;
}, {
    event: import("../constants/loyalty-connector").QlessqQueueIntegrationEvent;
    sourceId: string;
    customer?: {
        externalId: string;
        email?: string | null | undefined;
        name?: string | undefined;
        phone?: string | null | undefined;
    } | undefined;
    branchId?: string | undefined;
    serviceId?: string | null | undefined;
    customerId?: string | undefined;
    customerPhone?: string | null | undefined;
    customerEmail?: string | null | undefined;
    rating?: number | undefined;
    occurredAt?: string | undefined;
}>;
export declare const patronLoyaltyIntegrationConfigSchema: z.ZodObject<{
    lmsOrgId: z.ZodOptional<z.ZodString>;
    apiBaseUrl: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    lmsOrgId?: string | undefined;
    apiBaseUrl?: string | undefined;
}, {
    apiKey: string;
    lmsOrgId?: string | undefined;
    apiBaseUrl?: string | undefined;
}>;
//# sourceMappingURL=loyalty-integration.validators.d.ts.map