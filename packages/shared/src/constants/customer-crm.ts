// ─── Patron CRM ──────────────────────────────────

/** Built-in segment presets available on the customer directory. */
export const CUSTOMER_SEGMENT_PRESETS = {
  REPEAT_VISITORS_90D: 'repeat_visitors_90d',
  APPOINTMENT_NO_SHOW_LAST: 'appointment_no_show_last',
  LOW_RATING_REVIEW: 'low_rating_review',
  MARKETING_SMS_OPTED_IN: 'marketing_sms_opted_in',
} as const;

export type CustomerSegmentPreset =
  (typeof CUSTOMER_SEGMENT_PRESETS)[keyof typeof CUSTOMER_SEGMENT_PRESETS];

export const CUSTOMER_SEGMENT_PRESET_LABELS: Record<CustomerSegmentPreset, string> = {
  [CUSTOMER_SEGMENT_PRESETS.REPEAT_VISITORS_90D]: '3+ visits in 90 days',
  [CUSTOMER_SEGMENT_PRESETS.APPOINTMENT_NO_SHOW_LAST]: 'No-show on last appointment',
  [CUSTOMER_SEGMENT_PRESETS.LOW_RATING_REVIEW]: 'Review ≤ 3 stars',
  [CUSTOMER_SEGMENT_PRESETS.MARKETING_SMS_OPTED_IN]: 'Opted into marketing SMS',
};

export const CUSTOMER_SEGMENT_PRESET_VALUES = Object.values(
  CUSTOMER_SEGMENT_PRESETS,
) as CustomerSegmentPreset[];

/** Staff annotations stored on Customer.metadata */
export interface CustomerCrmMetadata {
  tags?: string[];
  notes?: string;
}
