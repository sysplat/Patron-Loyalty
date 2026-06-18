/**
 * Estimated all-in provider cost per delivered SMS segment (Twilio Canada long-code + carrier).
 * Used for pack pricing margins — not charged directly.
 */
export declare const SMS_WHOLESALE_UNIT_USD = 0.022;
/** Default retail price per billable SMS message shown to customers. */
export declare const SMS_RETAIL_UNIT_USD = 0.03;
/** Notification statuses that consume one SMS credit (provider accepted the send). */
export declare const BILLABLE_SMS_NOTIFICATION_STATUSES: readonly ["sent", "delivered"];
/**
 * Lifetime SMS credit allowances per plan (not monthly; no time-based expiry).
 * Change these values to adjust defaults; plan.limits.smsCreditsTotal in DB overrides per plan.
 * API may also override via SMS_CREDITS_FREE, SMS_CREDITS_PROFESSIONAL, SMS_CREDITS_ENTERPRISE.
 */
export declare const DEFAULT_SMS_CREDITS_BY_PLAN_SLUG: Record<string, number>;
/**
 * True when the provider assigned a real outbound SMS id (e.g. Twilio `SM…`).
 * Dev/console ids are excluded so local testing does not burn credits.
 */
export declare function isBillableSmsProviderMessageId(providerMessageId: string | null | undefined): boolean;
/** Redis key for org lifetime SMS send count (no date suffix, no TTL). */
export declare function smsLifetimeUsageKey(orgId: string): string;
/** Redis key for purchased SMS bonus messages (lifetime, no TTL). */
export declare function smsLifetimeBonusKey(orgId: string): string;
export interface SmsCreditsAllowance {
    planBase: number;
    purchasedBonus: number;
    effectiveLimit: number;
}
export declare function computeSmsCreditsAllowance(planBase: number, purchasedBonus: number): SmsCreditsAllowance;
/**
 * Resolve lifetime SMS allowance from plan limits JSON and slug fallback.
 */
export declare function resolveSmsCreditsTotalFromLimits(limits: Record<string, unknown>, planSlug?: string | null): number;
//# sourceMappingURL=sms-credits.d.ts.map