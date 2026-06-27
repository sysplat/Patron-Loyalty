import { z } from 'zod';
export declare const updateLoyaltyProgramSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    pointsCurrencyName: z.ZodOptional<z.ZodString>;
    displayCurrencyCode: z.ZodOptional<z.ZodString>;
    defaultLocale: z.ZodOptional<z.ZodString>;
    defaultEarnPoints: z.ZodOptional<z.ZodNumber>;
    referralBonusPoints: z.ZodOptional<z.ZodNumber>;
    referredBonusPoints: z.ZodOptional<z.ZodNumber>;
    pointsExpiryDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    enabled?: boolean | undefined;
    pointsCurrencyName?: string | undefined;
    displayCurrencyCode?: string | undefined;
    defaultLocale?: string | undefined;
    defaultEarnPoints?: number | undefined;
    referralBonusPoints?: number | undefined;
    referredBonusPoints?: number | undefined;
    pointsExpiryDays?: number | null | undefined;
}, {
    enabled?: boolean | undefined;
    pointsCurrencyName?: string | undefined;
    displayCurrencyCode?: string | undefined;
    defaultLocale?: string | undefined;
    defaultEarnPoints?: number | undefined;
    referralBonusPoints?: number | undefined;
    referredBonusPoints?: number | undefined;
    pointsExpiryDays?: number | null | undefined;
}>;
export declare const createLoyaltyTierSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    minLifetimePoints: z.ZodNumber;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    benefits: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    minLifetimePoints: number;
    sortOrder?: number | undefined;
    color?: string | null | undefined;
    benefits?: Record<string, unknown> | undefined;
}, {
    name: string;
    slug: string;
    minLifetimePoints: number;
    sortOrder?: number | undefined;
    color?: string | null | undefined;
    benefits?: Record<string, unknown> | undefined;
}>;
export declare const updateLoyaltyTierSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    minLifetimePoints: z.ZodOptional<z.ZodNumber>;
    sortOrder: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    color: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    benefits: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    sortOrder?: number | undefined;
    slug?: string | undefined;
    minLifetimePoints?: number | undefined;
    color?: string | null | undefined;
    benefits?: Record<string, unknown> | undefined;
}, {
    name?: string | undefined;
    sortOrder?: number | undefined;
    slug?: string | undefined;
    minLifetimePoints?: number | undefined;
    color?: string | null | undefined;
    benefits?: Record<string, unknown> | undefined;
}>;
export declare const createLoyaltyEarnRuleSchema: z.ZodObject<{
    name: z.ZodString;
    eventType: z.ZodEnum<["TICKET_COMPLETED", "APPOINTMENT_COMPLETED", "REVIEW_SUBMITTED", "REFERRAL_COMPLETED", "PURCHASE", "MANUAL"]>;
    points: z.ZodNumber;
    active: z.ZodOptional<z.ZodBoolean>;
    conditions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    eventType: "TICKET_COMPLETED" | "APPOINTMENT_COMPLETED" | "REVIEW_SUBMITTED" | "REFERRAL_COMPLETED" | "PURCHASE" | "MANUAL";
    points: number;
    active?: boolean | undefined;
    conditions?: Record<string, unknown> | undefined;
}, {
    name: string;
    eventType: "TICKET_COMPLETED" | "APPOINTMENT_COMPLETED" | "REVIEW_SUBMITTED" | "REFERRAL_COMPLETED" | "PURCHASE" | "MANUAL";
    points: number;
    active?: boolean | undefined;
    conditions?: Record<string, unknown> | undefined;
}>;
export declare const createLoyaltyRewardSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    type: z.ZodEnum<["DISCOUNT", "FREE_ITEM", "GIFT", "SERVICE"]>;
    pointsCost: z.ZodNumber;
    stock: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    active: z.ZodOptional<z.ZodBoolean>;
    validFrom: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    validUntil: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    imageUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "SERVICE" | "DISCOUNT" | "FREE_ITEM" | "GIFT";
    pointsCost: number;
    active?: boolean | undefined;
    description?: string | null | undefined;
    stock?: number | null | undefined;
    validFrom?: string | null | undefined;
    validUntil?: string | null | undefined;
    imageUrl?: string | null | undefined;
}, {
    name: string;
    type: "SERVICE" | "DISCOUNT" | "FREE_ITEM" | "GIFT";
    pointsCost: number;
    active?: boolean | undefined;
    description?: string | null | undefined;
    stock?: number | null | undefined;
    validFrom?: string | null | undefined;
    validUntil?: string | null | undefined;
    imageUrl?: string | null | undefined;
}>;
export declare const updateLoyaltyRewardSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    type: z.ZodOptional<z.ZodEnum<["DISCOUNT", "FREE_ITEM", "GIFT", "SERVICE"]>>;
    pointsCost: z.ZodOptional<z.ZodNumber>;
    stock: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    active: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    validFrom: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    validUntil: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    type?: "SERVICE" | "DISCOUNT" | "FREE_ITEM" | "GIFT" | undefined;
    pointsCost?: number | undefined;
    stock?: number | null | undefined;
    validFrom?: string | null | undefined;
    validUntil?: string | null | undefined;
    imageUrl?: string | null | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    description?: string | null | undefined;
    type?: "SERVICE" | "DISCOUNT" | "FREE_ITEM" | "GIFT" | undefined;
    pointsCost?: number | undefined;
    stock?: number | null | undefined;
    validFrom?: string | null | undefined;
    validUntil?: string | null | undefined;
    imageUrl?: string | null | undefined;
}>;
export declare const redeemLoyaltyRewardSchema: z.ZodObject<{
    customerId: z.ZodString;
    rewardId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    rewardId: string;
}, {
    customerId: string;
    rewardId: string;
}>;
export declare const createLoyaltyCouponSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["PERCENT", "FIXED", "BOGO"]>;
    value: z.ZodNumber;
    minPurchaseCents: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxUses: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    active: z.ZodOptional<z.ZodBoolean>;
    validFrom: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    validUntil: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    tierSlugs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    value: number;
    code: string;
    type: "PERCENT" | "FIXED" | "BOGO";
    active?: boolean | undefined;
    validFrom?: string | null | undefined;
    validUntil?: string | null | undefined;
    minPurchaseCents?: number | null | undefined;
    maxUses?: number | null | undefined;
    tierSlugs?: string[] | undefined;
}, {
    name: string;
    value: number;
    code: string;
    type: "PERCENT" | "FIXED" | "BOGO";
    active?: boolean | undefined;
    validFrom?: string | null | undefined;
    validUntil?: string | null | undefined;
    minPurchaseCents?: number | null | undefined;
    maxUses?: number | null | undefined;
    tierSlugs?: string[] | undefined;
}>;
export declare const validateLoyaltyCouponSchema: z.ZodObject<{
    code: z.ZodString;
    accountId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    accountId?: string | undefined;
}, {
    code: string;
    accountId?: string | undefined;
}>;
export declare const loyaltyWalletAdjustSchema: z.ZodObject<{
    type: z.ZodEnum<["CREDIT", "DEBIT", "REFUND", "CASHBACK", "BONUS", "GIFT"]>;
    amountCents: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "BONUS" | "GIFT" | "CREDIT" | "DEBIT" | "REFUND" | "CASHBACK";
    amountCents: number;
    description?: string | undefined;
}, {
    type: "BONUS" | "GIFT" | "CREDIT" | "DEBIT" | "REFUND" | "CASHBACK";
    amountCents: number;
    description?: string | undefined;
}>;
export declare const loyaltyPointsAdjustSchema: z.ZodObject<{
    points: z.ZodEffects<z.ZodNumber, number, number>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    points: number;
    description?: string | undefined;
}, {
    points: number;
    description?: string | undefined;
}>;
export declare const createReferralSchema: z.ZodObject<{
    referralCode: z.ZodString;
    customerId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    referralCode: string;
}, {
    customerId: string;
    referralCode: string;
}>;
export declare const createLoyaltyCampaignSchema: z.ZodObject<{
    name: z.ZodString;
    channel: z.ZodEnum<["SMS", "EMAIL", "PUSH", "WHATSAPP", "IN_APP"]>;
    trigger: z.ZodEnum<["WELCOME", "BIRTHDAY", "WIN_BACK", "TIER_UPGRADE", "ABANDONED", "MANUAL"]>;
    subject: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    body: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    segmentPreset: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    scheduledAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    channel: "SMS" | "EMAIL" | "PUSH" | "WHATSAPP" | "IN_APP";
    trigger: "MANUAL" | "WELCOME" | "BIRTHDAY" | "WIN_BACK" | "TIER_UPGRADE" | "ABANDONED";
    scheduledAt?: string | null | undefined;
    subject?: string | null | undefined;
    body?: string | null | undefined;
    segmentPreset?: string | null | undefined;
}, {
    name: string;
    channel: "SMS" | "EMAIL" | "PUSH" | "WHATSAPP" | "IN_APP";
    trigger: "MANUAL" | "WELCOME" | "BIRTHDAY" | "WIN_BACK" | "TIER_UPGRADE" | "ABANDONED";
    scheduledAt?: string | null | undefined;
    subject?: string | null | undefined;
    body?: string | null | undefined;
    segmentPreset?: string | null | undefined;
}>;
export declare const updateLoyaltyCampaignSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    channel: z.ZodOptional<z.ZodEnum<["SMS", "EMAIL", "PUSH", "WHATSAPP", "IN_APP"]>>;
    trigger: z.ZodOptional<z.ZodEnum<["WELCOME", "BIRTHDAY", "WIN_BACK", "TIER_UPGRADE", "ABANDONED", "MANUAL"]>>;
    subject: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    body: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    segmentPreset: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    scheduledAt: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
} & {
    status: z.ZodOptional<z.ZodEnum<["draft", "scheduled", "active", "paused", "completed"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    status?: "active" | "paused" | "completed" | "draft" | "scheduled" | undefined;
    scheduledAt?: string | null | undefined;
    channel?: "SMS" | "EMAIL" | "PUSH" | "WHATSAPP" | "IN_APP" | undefined;
    subject?: string | null | undefined;
    body?: string | null | undefined;
    trigger?: "MANUAL" | "WELCOME" | "BIRTHDAY" | "WIN_BACK" | "TIER_UPGRADE" | "ABANDONED" | undefined;
    segmentPreset?: string | null | undefined;
}, {
    name?: string | undefined;
    status?: "active" | "paused" | "completed" | "draft" | "scheduled" | undefined;
    scheduledAt?: string | null | undefined;
    channel?: "SMS" | "EMAIL" | "PUSH" | "WHATSAPP" | "IN_APP" | undefined;
    subject?: string | null | undefined;
    body?: string | null | undefined;
    trigger?: "MANUAL" | "WELCOME" | "BIRTHDAY" | "WIN_BACK" | "TIER_UPGRADE" | "ABANDONED" | undefined;
    segmentPreset?: string | null | undefined;
}>;
export declare const updateLoyaltyEarnRuleSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    points: z.ZodOptional<z.ZodNumber>;
    active: z.ZodOptional<z.ZodBoolean>;
    conditions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    name?: string | undefined;
    points?: number | undefined;
    conditions?: Record<string, unknown> | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    points?: number | undefined;
    conditions?: Record<string, unknown> | undefined;
}>;
export declare const createCrmSupportTicketSchema: z.ZodObject<{
    customerId: z.ZodString;
    subject: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
    assigneeId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    subject: string;
    priority?: "normal" | "low" | "high" | "urgent" | undefined;
    description?: string | null | undefined;
    assigneeId?: string | null | undefined;
}, {
    customerId: string;
    subject: string;
    priority?: "normal" | "low" | "high" | "urgent" | undefined;
    description?: string | null | undefined;
    assigneeId?: string | null | undefined;
}>;
export declare const updateCrmSupportTicketSchema: z.ZodObject<{
    subject: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
    status: z.ZodOptional<z.ZodEnum<["open", "pending", "resolved", "closed"]>>;
    assigneeId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    priority?: "normal" | "low" | "high" | "urgent" | undefined;
    status?: "open" | "closed" | "pending" | "resolved" | undefined;
    description?: string | null | undefined;
    subject?: string | undefined;
    assigneeId?: string | null | undefined;
}, {
    priority?: "normal" | "low" | "high" | "urgent" | undefined;
    status?: "open" | "closed" | "pending" | "resolved" | undefined;
    description?: string | null | undefined;
    subject?: string | undefined;
    assigneeId?: string | null | undefined;
}>;
export declare const createCrmSalesOpportunitySchema: z.ZodObject<{
    customerId: z.ZodString;
    title: z.ZodString;
    stage: z.ZodOptional<z.ZodEnum<["lead", "qualified", "proposal", "negotiation", "won", "lost"]>>;
    valueCents: z.ZodOptional<z.ZodNumber>;
    expectedCloseDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigneeId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    title: string;
    notes?: string | null | undefined;
    assigneeId?: string | null | undefined;
    stage?: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | undefined;
    valueCents?: number | undefined;
    expectedCloseDate?: string | null | undefined;
}, {
    customerId: string;
    title: string;
    notes?: string | null | undefined;
    assigneeId?: string | null | undefined;
    stage?: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | undefined;
    valueCents?: number | undefined;
    expectedCloseDate?: string | null | undefined;
}>;
export declare const updateCrmSalesOpportunitySchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    stage: z.ZodOptional<z.ZodEnum<["lead", "qualified", "proposal", "negotiation", "won", "lost"]>>;
    valueCents: z.ZodOptional<z.ZodNumber>;
    expectedCloseDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigneeId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | null | undefined;
    title?: string | undefined;
    assigneeId?: string | null | undefined;
    stage?: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | undefined;
    valueCents?: number | undefined;
    expectedCloseDate?: string | null | undefined;
}, {
    notes?: string | null | undefined;
    title?: string | undefined;
    assigneeId?: string | null | undefined;
    stage?: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | undefined;
    valueCents?: number | undefined;
    expectedCloseDate?: string | null | undefined;
}>;
export declare const createLoyaltyBadgeSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    icon: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    criteria: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
    icon?: string | null | undefined;
    criteria?: Record<string, unknown> | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    icon?: string | null | undefined;
    criteria?: Record<string, unknown> | undefined;
}>;
export declare const createLoyaltyChallengeSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    targetType: z.ZodEnum<["VISITS", "POINTS_EARNED", "REFERRALS"]>;
    targetValue: z.ZodNumber;
    rewardPoints: z.ZodOptional<z.ZodNumber>;
    startAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    endAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    targetType: "VISITS" | "POINTS_EARNED" | "REFERRALS";
    targetValue: number;
    description?: string | null | undefined;
    rewardPoints?: number | undefined;
    startAt?: string | null | undefined;
    endAt?: string | null | undefined;
}, {
    name: string;
    targetType: "VISITS" | "POINTS_EARNED" | "REFERRALS";
    targetValue: number;
    description?: string | null | undefined;
    rewardPoints?: number | undefined;
    startAt?: string | null | undefined;
    endAt?: string | null | undefined;
}>;
export declare const createGiftCardSchema: z.ZodObject<{
    initialBalanceCents: z.ZodNumber;
    recipientEmail: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    expiresAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    initialBalanceCents: number;
    recipientEmail?: string | null | undefined;
    expiresAt?: string | null | undefined;
}, {
    initialBalanceCents: number;
    recipientEmail?: string | null | undefined;
    expiresAt?: string | null | undefined;
}>;
export declare const createCrmTaskSchema: z.ZodObject<{
    customerId: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    dueAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigneeId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    customerId: string;
    title: string;
    description?: string | null | undefined;
    assigneeId?: string | null | undefined;
    dueAt?: string | null | undefined;
}, {
    customerId: string;
    title: string;
    description?: string | null | undefined;
    assigneeId?: string | null | undefined;
    dueAt?: string | null | undefined;
}>;
export declare const updateCrmTaskSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["open", "in_progress", "done", "cancelled"]>>;
    dueAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigneeId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "open" | "cancelled" | "in_progress" | "done" | undefined;
    description?: string | null | undefined;
    title?: string | undefined;
    assigneeId?: string | null | undefined;
    dueAt?: string | null | undefined;
}, {
    status?: "open" | "cancelled" | "in_progress" | "done" | undefined;
    description?: string | null | undefined;
    title?: string | undefined;
    assigneeId?: string | null | undefined;
    dueAt?: string | null | undefined;
}>;
export declare const updateLoyaltyProfileSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    birthday: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    gender: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    addressLine1: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    city: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    region: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    postalCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    country: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email?: string | null | undefined;
    name?: string | undefined;
    phone?: string | null | undefined;
    country?: string | null | undefined;
    birthday?: string | null | undefined;
    gender?: string | null | undefined;
    addressLine1?: string | null | undefined;
    city?: string | null | undefined;
    region?: string | null | undefined;
    postalCode?: string | null | undefined;
}, {
    email?: string | null | undefined;
    name?: string | undefined;
    phone?: string | null | undefined;
    country?: string | null | undefined;
    birthday?: string | null | undefined;
    gender?: string | null | undefined;
    addressLine1?: string | null | undefined;
    city?: string | null | undefined;
    region?: string | null | undefined;
    postalCode?: string | null | undefined;
}>;
//# sourceMappingURL=loyalty.validators.d.ts.map