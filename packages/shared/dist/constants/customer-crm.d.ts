/** Built-in segment presets available on the customer directory. */
export declare const CUSTOMER_SEGMENT_PRESETS: {
    readonly REPEAT_VISITORS_90D: "repeat_visitors_90d";
    readonly APPOINTMENT_NO_SHOW_LAST: "appointment_no_show_last";
    readonly LOW_RATING_REVIEW: "low_rating_review";
    readonly MARKETING_SMS_OPTED_IN: "marketing_sms_opted_in";
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