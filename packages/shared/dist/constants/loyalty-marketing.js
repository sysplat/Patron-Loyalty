"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAILCHIMP_LOYALTY_MERGE_FIELDS = exports.KLAVIYO_LOYALTY_PROPERTIES = exports.LOYALTY_MARKETING_PROVIDER_VALUES = exports.LOYALTY_MARKETING_PROVIDERS = void 0;
exports.LOYALTY_MARKETING_PROVIDERS = {
    KLAVIYO: 'klaviyo',
    MAILCHIMP: 'mailchimp',
};
exports.LOYALTY_MARKETING_PROVIDER_VALUES = Object.values(exports.LOYALTY_MARKETING_PROVIDERS);
/**
 * Klaviyo custom property keys pushed to profiles.
 * Keep in sync with loyalty-marketing-klaviyo.provider.ts.
 */
exports.KLAVIYO_LOYALTY_PROPERTIES = {
    POINTS: 'loyalty_points',
    TIER: 'loyalty_tier',
    LIFETIME_VALUE_CENTS: 'loyalty_lifetime_value_cents',
    TOTAL_VISITS: 'loyalty_total_visits',
    REFERRAL_URL: 'loyalty_referral_url',
};
/**
 * Mailchimp merge field keys pushed to list members.
 * Keep in sync with loyalty-marketing-mailchimp.provider.ts.
 */
exports.MAILCHIMP_LOYALTY_MERGE_FIELDS = {
    POINTS: 'LPOINTS',
    TIER: 'LTIER',
    TOTAL_VISITS: 'LTOTVIS',
    REFERRAL_URL: 'LREFURL',
};
//# sourceMappingURL=loyalty-marketing.js.map