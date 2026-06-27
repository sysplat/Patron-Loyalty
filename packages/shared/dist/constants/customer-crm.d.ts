/** Built-in segment presets available on the customer directory. */
export declare const CUSTOMER_SEGMENT_PRESETS: {
    readonly REPEAT_VISITORS_90D: "repeat_visitors_90d";
    readonly APPOINTMENT_NO_SHOW_LAST: "appointment_no_show_last";
    readonly LOW_RATING_REVIEW: "low_rating_review";
    readonly MARKETING_SMS_OPTED_IN: "marketing_sms_opted_in";
    /** Loyalty: Gold+ tier or 5k+ lifetime points (SRS §16 VIP / §7). */
    readonly LOYALTY_VIP: "loyalty_vip";
    /** Loyalty: no ledger activity in 90 days (SRS §16 inactive). */
    readonly LOYALTY_INACTIVE_90D: "loyalty_inactive_90d";
    /** Loyalty: lifetime value ≥ $1,000 (SRS §16 / §17 CLV). */
    readonly LOYALTY_HIGH_LTV: "loyalty_high_ltv";
    /** Loyalty: high recency + frequency + monetary proxy (SRS §16 RFM). */
    readonly LOYALTY_RFM_CHAMPIONS: "loyalty_rfm_champions";
    /** Loyalty: medium/high churn risk flag (SRS §24 health). */
    readonly LOYALTY_AT_RISK: "loyalty_at_risk";
};
export type CustomerSegmentPreset = (typeof CUSTOMER_SEGMENT_PRESETS)[keyof typeof CUSTOMER_SEGMENT_PRESETS];
export declare const CUSTOMER_SEGMENT_PRESET_LABELS: Record<CustomerSegmentPreset, string>;
export declare const CUSTOMER_SEGMENT_PRESET_VALUES: CustomerSegmentPreset[];
/** Staff annotations stored on Customer.metadata */
export interface CustomerCrmMetadata {
    tags?: string[];
    notes?: string;
}
//# sourceMappingURL=customer-crm.d.ts.map