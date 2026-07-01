export const LOYALTY_MARKETING_PROVIDERS = {
  KLAVIYO: 'klaviyo',
  MAILCHIMP: 'mailchimp',
} as const;

export type LoyaltyMarketingProvider =
  (typeof LOYALTY_MARKETING_PROVIDERS)[keyof typeof LOYALTY_MARKETING_PROVIDERS];

export const LOYALTY_MARKETING_PROVIDER_VALUES = Object.values(
  LOYALTY_MARKETING_PROVIDERS,
) as LoyaltyMarketingProvider[];

/**
 * Klaviyo custom property keys pushed to profiles.
 * Keep in sync with loyalty-marketing-klaviyo.provider.ts.
 */
export const KLAVIYO_LOYALTY_PROPERTIES = {
  POINTS: 'loyalty_points',
  TIER: 'loyalty_tier',
  LIFETIME_VALUE_CENTS: 'loyalty_lifetime_value_cents',
  TOTAL_VISITS: 'loyalty_total_visits',
  REFERRAL_URL: 'loyalty_referral_url',
} as const;

/**
 * Mailchimp merge field keys pushed to list members.
 * Keep in sync with loyalty-marketing-mailchimp.provider.ts.
 */
export const MAILCHIMP_LOYALTY_MERGE_FIELDS = {
  POINTS: 'LPOINTS',
  TIER: 'LTIER',
  TOTAL_VISITS: 'LTOTVIS',
  REFERRAL_URL: 'LREFURL',
} as const;
