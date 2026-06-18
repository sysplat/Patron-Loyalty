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
//# sourceMappingURL=loyalty-integration.validators.d.ts.map