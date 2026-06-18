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
};
exports.CUSTOMER_SEGMENT_PRESET_LABELS = {
    [exports.CUSTOMER_SEGMENT_PRESETS.REPEAT_VISITORS_90D]: '3+ visits in 90 days',
    [exports.CUSTOMER_SEGMENT_PRESETS.APPOINTMENT_NO_SHOW_LAST]: 'No-show on last appointment',
    [exports.CUSTOMER_SEGMENT_PRESETS.LOW_RATING_REVIEW]: 'Review ≤ 3 stars',
    [exports.CUSTOMER_SEGMENT_PRESETS.MARKETING_SMS_OPTED_IN]: 'Opted into marketing SMS',
};
exports.CUSTOMER_SEGMENT_PRESET_VALUES = Object.values(exports.CUSTOMER_SEGMENT_PRESETS);
//# sourceMappingURL=customer-crm.js.map