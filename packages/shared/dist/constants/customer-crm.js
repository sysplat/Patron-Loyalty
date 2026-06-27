"use strict";
// ─── Patron CRM ──────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOMER_SEGMENT_PRESET_VALUES = exports.CUSTOMER_SEGMENT_PRESET_LABELS = exports.CUSTOMER_SEGMENT_PRESETS = void 0;
/** Built-in segment presets available on the customer directory. */
exports.CUSTOMER_SEGMENT_PRESETS = {
    REPEAT_VISITORS_90D: 'repeat_visitors_90d',
    APPOINTMENT_NO_SHOW_LAST: 'appointment_no_show_last',
    LOW_RATING_REVIEW: 'low_rating_review',
    MARKETING_SMS_OPTED_IN: 'marketing_sms_opted_in',
    /** Loyalty: Gold+ tier or 5k+ lifetime points (SRS §16 VIP / §7). */
    LOYALTY_VIP: 'loyalty_vip',
    /** Loyalty: no ledger activity in 90 days (SRS §16 inactive). */
    LOYALTY_INACTIVE_90D: 'loyalty_inactive_90d',
    /** Loyalty: lifetime value ≥ $1,000 (SRS §16 / §17 CLV). */
    LOYALTY_HIGH_LTV: 'loyalty_high_ltv',
    /** Loyalty: high recency + frequency + monetary proxy (SRS §16 RFM). */
    LOYALTY_RFM_CHAMPIONS: 'loyalty_rfm_champions',
    /** Loyalty: medium/high churn risk flag (SRS §24 health). */
    LOYALTY_AT_RISK: 'loyalty_at_risk',
};
exports.CUSTOMER_SEGMENT_PRESET_LABELS = {
    [exports.CUSTOMER_SEGMENT_PRESETS.REPEAT_VISITORS_90D]: '3+ visits in 90 days',
    [exports.CUSTOMER_SEGMENT_PRESETS.APPOINTMENT_NO_SHOW_LAST]: 'No-show on last appointment',
    [exports.CUSTOMER_SEGMENT_PRESETS.LOW_RATING_REVIEW]: 'Review ≤ 3 stars',
    [exports.CUSTOMER_SEGMENT_PRESETS.MARKETING_SMS_OPTED_IN]: 'Opted into marketing SMS',
    [exports.CUSTOMER_SEGMENT_PRESETS.LOYALTY_VIP]: 'VIP members (Gold+ or 5k+ pts)',
    [exports.CUSTOMER_SEGMENT_PRESETS.LOYALTY_INACTIVE_90D]: 'Inactive 90+ days (no points activity)',
    [exports.CUSTOMER_SEGMENT_PRESETS.LOYALTY_HIGH_LTV]: 'High lifetime value ($1k+)',
    [exports.CUSTOMER_SEGMENT_PRESETS.LOYALTY_RFM_CHAMPIONS]: 'RFM champions (active, frequent, high spend)',
    [exports.CUSTOMER_SEGMENT_PRESETS.LOYALTY_AT_RISK]: 'At-risk (churn flag)',
};
exports.CUSTOMER_SEGMENT_PRESET_VALUES = Object.values(exports.CUSTOMER_SEGMENT_PRESETS);
//# sourceMappingURL=customer-crm.js.map