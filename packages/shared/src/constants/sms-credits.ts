/**
 * Estimated all-in provider cost per delivered SMS segment (Twilio Canada long-code + carrier).
 * Used for pack pricing margins — not charged directly.
 */
export const SMS_WHOLESALE_UNIT_USD = 0.022;

/** Default retail price per billable SMS message shown to customers. */
export const SMS_RETAIL_UNIT_USD = 0.03;

/** Notification statuses that consume one SMS credit (provider accepted the send). */
export const BILLABLE_SMS_NOTIFICATION_STATUSES = ['sent', 'delivered'] as const;

/**
 * Lifetime SMS credit allowances per plan (not monthly; no time-based expiry).
 * Change these values to adjust defaults; plan.limits.smsCreditsTotal in DB overrides per plan.
 * API may also override via SMS_CREDITS_FREE, SMS_CREDITS_PROFESSIONAL, SMS_CREDITS_ENTERPRISE.
 */
export const DEFAULT_SMS_CREDITS_BY_PLAN_SLUG: Record<string, number> = {
  free: 100,
  professional: 5_000,
  enterprise: 25_000,
  'loyalty-starter': 500,
};

/**
 * True when the provider assigned a real outbound SMS id (e.g. Twilio `SM…`).
 * Dev/console ids are excluded so local testing does not burn credits.
 */
export function isBillableSmsProviderMessageId(
  providerMessageId: string | null | undefined,
): boolean {
  if (!providerMessageId) return false;
  return /^SM[a-f0-9]{32}$/i.test(providerMessageId);
}

/** Redis key for org lifetime SMS send count (no date suffix, no TTL). */
export function smsLifetimeUsageKey(orgId: string): string {
  return `sms:credits:used:lifetime:${orgId}`;
}

/** Redis key for purchased SMS bonus messages (lifetime, no TTL). */
export function smsLifetimeBonusKey(orgId: string): string {
  return `sms:credits:bonus:lifetime:${orgId}`;
}

export interface SmsCreditsAllowance {
  planBase: number;
  purchasedBonus: number;
  effectiveLimit: number;
}

export function computeSmsCreditsAllowance(
  planBase: number,
  purchasedBonus: number,
): SmsCreditsAllowance {
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
export function resolveSmsCreditsTotalFromLimits(
  limits: Record<string, unknown>,
  planSlug?: string | null,
): number {
  if (typeof limits.smsCreditsTotal === 'number' && Number.isFinite(limits.smsCreditsTotal)) {
    return Math.max(0, limits.smsCreditsTotal);
  }
  /** @deprecated monthly key treated as lifetime total for backward compatibility */
  if (typeof limits.smsCreditsPerMonth === 'number' && Number.isFinite(limits.smsCreditsPerMonth)) {
    return Math.max(0, limits.smsCreditsPerMonth);
  }
  if (planSlug && planSlug in DEFAULT_SMS_CREDITS_BY_PLAN_SLUG) {
    return DEFAULT_SMS_CREDITS_BY_PLAN_SLUG[planSlug];
  }
  return DEFAULT_SMS_CREDITS_BY_PLAN_SLUG.free;
}
