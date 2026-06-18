import { resolveSmsCreditsTotalFromLimits, smsLifetimeUsageKey } from '@queueplatform/shared';

export { smsLifetimeUsageKey };

const ENV_KEY_BY_SLUG: Record<string, string> = {
  free: 'SMS_CREDITS_FREE',
  professional: 'SMS_CREDITS_PROFESSIONAL',
  enterprise: 'SMS_CREDITS_ENTERPRISE',
};

/**
 * Lifetime SMS allowance for an org: plan.limits.smsCreditsTotal → env override → plan slug default.
 */
export function resolveSmsCreditsLimit(
  limits: Record<string, unknown>,
  planSlug?: string | null,
): number {
  if (typeof limits.smsCreditsTotal === 'number' && Number.isFinite(limits.smsCreditsTotal)) {
    return Math.max(0, limits.smsCreditsTotal);
  }

  const envKey = planSlug ? ENV_KEY_BY_SLUG[planSlug] : undefined;
  if (envKey && process.env[envKey] !== undefined && process.env[envKey] !== '') {
    const parsed = Number.parseInt(process.env[envKey]!, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }

  return resolveSmsCreditsTotalFromLimits(limits, planSlug);
}
