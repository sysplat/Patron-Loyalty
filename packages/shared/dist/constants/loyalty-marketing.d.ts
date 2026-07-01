export declare const LOYALTY_MARKETING_PROVIDERS: {
    readonly KLAVIYO: "klaviyo";
    readonly MAILCHIMP: "mailchimp";
};
export type LoyaltyMarketingProvider = (typeof LOYALTY_MARKETING_PROVIDERS)[keyof typeof LOYALTY_MARKETING_PROVIDERS];
export declare const LOYALTY_MARKETING_PROVIDER_VALUES: LoyaltyMarketingProvider[];
/**
 * Klaviyo custom property keys pushed to profiles.
 * Keep in sync with loyalty-marketing-klaviyo.provider.ts.
 */
export declare const KLAVIYO_LOYALTY_PROPERTIES: {
    readonly POINTS: "loyalty_points";
    readonly TIER: "loyalty_tier";
    readonly LIFETIME_VALUE_CENTS: "loyalty_lifetime_value_cents";
    readonly TOTAL_VISITS: "loyalty_total_visits";
    readonly REFERRAL_URL: "loyalty_referral_url";
};
/**
 * Mailchimp merge field keys pushed to list members.
 * Keep in sync with loyalty-marketing-mailchimp.provider.ts.
 */
export declare const MAILCHIMP_LOYALTY_MERGE_FIELDS: {
    readonly POINTS: "LPOINTS";
    readonly TIER: "LTIER";
    readonly TOTAL_VISITS: "LTOTVIS";
    readonly REFERRAL_URL: "LREFURL";
};
//# sourceMappingURL=loyalty-marketing.d.ts.map