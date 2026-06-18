"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SMS_CREDITS_BY_PLAN_SLUG = exports.BILLABLE_SMS_NOTIFICATION_STATUSES = exports.SMS_RETAIL_UNIT_USD = exports.SMS_WHOLESALE_UNIT_USD = void 0;
exports.isBillableSmsProviderMessageId = isBillableSmsProviderMessageId;
exports.smsLifetimeUsageKey = smsLifetimeUsageKey;
exports.smsLifetimeBonusKey = smsLifetimeBonusKey;
exports.computeSmsCreditsAllowance = computeSmsCreditsAllowance;
exports.resolveSmsCreditsTotalFromLimits = resolveSmsCreditsTotalFromLimits;
/**
 * Estimated all-in provider cost per delivered SMS segment (Twilio Canada long-code + carrier).
 * Used for pack pricing margins — not charged directly.
 */
exports.SMS_WHOLESALE_UNIT_USD = 0.022;
/** Default retail price per billable SMS message shown to customers. */
exports.SMS_RETAIL_UNIT_USD = 0.03;
/** Notification statuses that consume one SMS credit (provider accepted the send). */
exports.BILLABLE_SMS_NOTIFICATION_STATUSES = ['sent', 'delivered'];
/**
 * Lifetime SMS credit allowances per plan (not monthly; no time-based expiry).
 * Change these values to adjust defaults; plan.limits.smsCreditsTotal in DB overrides per plan.
 * API may also override via SMS_CREDITS_FREE, SMS_CREDITS_PROFESSIONAL, SMS_CREDITS_ENTERPRISE.
 */
exports.DEFAULT_SMS_CREDITS_BY_PLAN_SLUG = {
    free: 100,
    professional: 5_000,
    enterprise: 25_000,
    'loyalty-starter': 500,
};
/**
 * True when the provider assigned a real outbound SMS id (e.g. Twilio `SM…`).
 * Dev/console ids are excluded so local testing does not burn credits.
 */
function isBillableSmsProviderMessageId(providerMessageId) {
    if (!providerMessageId)
        return false;
    return /^SM[a-f0-9]{32}$/i.test(providerMessageId);
}
/** Redis key for org lifetime SMS send count (no date suffix, no TTL). */
function smsLifetimeUsageKey(orgId) {
    return `sms:credits:used:lifetime:${orgId}`;
}
/** Redis key for purchased SMS bonus messages (lifetime, no TTL). */
function smsLifetimeBonusKey(orgId) {
    return `sms:credits:bonus:lifetime:${orgId}`;
}
function computeSmsCreditsAllowance(planBase, purchasedBonus) {
    const base = Math.max(0, planBase);
    const bonus = Math.max(0, purchasedBonus);
    return {
        planBase: base,
        purchasedBonus: bonus,
        effectiveLimit: base + bonus,
    };
}
/**
 * Resolve lifetime SMS allowance from plan limits JSON and slug fallback.
 */
function resolveSmsCreditsTotalFromLimits(limits, planSlug) {
    if (typeof limits.smsCreditsTotal === 'number' && Number.isFinite(limits.smsCreditsTotal)) {
        return Math.max(0, limits.smsCreditsTotal);
    }
    /** @deprecated monthly key treated as lifetime total for backward compatibility */
    if (typeof limits.smsCreditsPerMonth === 'number' && Number.isFinite(limits.smsCreditsPerMonth)) {
        return Math.max(0, limits.smsCreditsPerMonth);
    }
    if (planSlug && planSlug in exports.DEFAULT_SMS_CREDITS_BY_PLAN_SLUG) {
        return exports.DEFAULT_SMS_CREDITS_BY_PLAN_SLUG[planSlug];
    }
    return exports.DEFAULT_SMS_CREDITS_BY_PLAN_SLUG.free;
}
//# sourceMappingURL=sms-credits.js.map