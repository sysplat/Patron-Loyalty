"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOYALTY_WEBHOOK_EVENTS = exports.LOYALTY_EVENTS = exports.CRM_TASK_STATUSES = exports.LOYALTY_CHALLENGE_TARGET_TYPES = exports.LOYALTY_DEFAULT_EARN_RULES = exports.LOYALTY_DEFAULT_TIERS = exports.LOYALTY_CAMPAIGN_STATUSES = exports.LOYALTY_CAMPAIGN_TRIGGERS = exports.LOYALTY_CAMPAIGN_CHANNELS = exports.LOYALTY_WALLET_TX_TYPES = exports.LOYALTY_COUPON_TYPES = exports.LOYALTY_REWARD_TYPES = exports.LOYALTY_INTEGRATION_API_KEY_SETTING = exports.LOYALTY_EARN_EVENT_TYPES = exports.LOYALTY_POINT_LEDGER_TYPES = void 0;
exports.LOYALTY_POINT_LEDGER_TYPES = {
    EARN: 'EARN',
    BURN: 'BURN',
    EXPIRE: 'EXPIRE',
    BONUS: 'BONUS',
    ADJUST: 'ADJUST',
};
exports.LOYALTY_EARN_EVENT_TYPES = {
    TICKET_COMPLETED: 'TICKET_COMPLETED',
    APPOINTMENT_COMPLETED: 'APPOINTMENT_COMPLETED',
    REVIEW_SUBMITTED: 'REVIEW_SUBMITTED',
    REFERRAL_COMPLETED: 'REFERRAL_COMPLETED',
    PURCHASE: 'PURCHASE',
    MANUAL: 'MANUAL',
};
/** Setting key for hashed LMS integration API key (`{ hash, prefix, createdAt }`). */
exports.LOYALTY_INTEGRATION_API_KEY_SETTING = 'loyalty_integration_api_key';
exports.LOYALTY_REWARD_TYPES = {
    DISCOUNT: 'DISCOUNT',
    FREE_ITEM: 'FREE_ITEM',
    GIFT: 'GIFT',
    SERVICE: 'SERVICE',
};
exports.LOYALTY_COUPON_TYPES = {
    PERCENT: 'PERCENT',
    FIXED: 'FIXED',
    BOGO: 'BOGO',
};
exports.LOYALTY_WALLET_TX_TYPES = {
    CREDIT: 'CREDIT',
    DEBIT: 'DEBIT',
    REFUND: 'REFUND',
    CASHBACK: 'CASHBACK',
    BONUS: 'BONUS',
    GIFT: 'GIFT',
};
exports.LOYALTY_CAMPAIGN_CHANNELS = {
    SMS: 'SMS',
    EMAIL: 'EMAIL',
    PUSH: 'PUSH',
    WHATSAPP: 'WHATSAPP',
    IN_APP: 'IN_APP',
};
exports.LOYALTY_CAMPAIGN_TRIGGERS = {
    WELCOME: 'WELCOME',
    BIRTHDAY: 'BIRTHDAY',
    WIN_BACK: 'WIN_BACK',
    TIER_UPGRADE: 'TIER_UPGRADE',
    ABANDONED: 'ABANDONED',
    MANUAL: 'MANUAL',
};
exports.LOYALTY_CAMPAIGN_STATUSES = {
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed',
};
exports.LOYALTY_DEFAULT_TIERS = [
    { slug: 'bronze', name: 'Bronze', minLifetimePoints: 0, sortOrder: 0, color: '#CD7F32' },
    { slug: 'silver', name: 'Silver', minLifetimePoints: 500, sortOrder: 1, color: '#C0C0C0' },
    { slug: 'gold', name: 'Gold', minLifetimePoints: 1500, sortOrder: 2, color: '#FFD700' },
    { slug: 'platinum', name: 'Platinum', minLifetimePoints: 5000, sortOrder: 3, color: '#E5E4E2' },
    { slug: 'diamond', name: 'Diamond', minLifetimePoints: 10000, sortOrder: 4, color: '#B9F2FF' },
];
exports.LOYALTY_DEFAULT_EARN_RULES = [
    { eventType: exports.LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED, name: 'Visit completed', points: 10 },
    {
        eventType: exports.LOYALTY_EARN_EVENT_TYPES.APPOINTMENT_COMPLETED,
        name: 'Appointment completed',
        points: 15,
    },
    { eventType: exports.LOYALTY_EARN_EVENT_TYPES.REVIEW_SUBMITTED, name: 'Review submitted', points: 5 },
    {
        eventType: exports.LOYALTY_EARN_EVENT_TYPES.PURCHASE,
        name: 'Purchase (1 pt per dollar)',
        points: 1,
    },
    { eventType: exports.LOYALTY_EARN_EVENT_TYPES.MANUAL, name: 'Manual / POS', points: 0 },
];
exports.LOYALTY_CHALLENGE_TARGET_TYPES = {
    VISITS: 'VISITS',
    POINTS_EARNED: 'POINTS_EARNED',
    REFERRALS: 'REFERRALS',
};
exports.CRM_TASK_STATUSES = {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    DONE: 'done',
    CANCELLED: 'cancelled',
};
exports.LOYALTY_EVENTS = {
    TICKET_COMPLETED: 'loyalty.ticket.completed',
    TICKET_NO_SHOW: 'loyalty.ticket.no_show',
    APPOINTMENT_COMPLETED: 'loyalty.appointment.completed',
    APPOINTMENT_NO_SHOW: 'loyalty.appointment.no_show',
    REVIEW_SUBMITTED: 'loyalty.review.submitted',
    CUSTOMER_CREATED: 'loyalty.customer.created',
    TIER_UPGRADED: 'loyalty.tier.upgraded',
    POINTS_EARNED: 'loyalty.points.earned',
    POINTS_REDEEMED: 'loyalty.points.redeemed',
};
/** Tenant webhook event types for outbound LMS integrations. */
exports.LOYALTY_WEBHOOK_EVENTS = {
    CUSTOMER_CREATED: 'loyalty.customer.created',
    POINTS_EARNED: 'loyalty.points.earned',
    POINTS_REDEEMED: 'loyalty.points.redeemed',
    TIER_UPGRADED: 'loyalty.tier.upgraded',
    VISIT_NO_SHOW: 'loyalty.visit.no_show',
    REWARD_REDEEMED: 'loyalty.reward.redeemed',
};
//# sourceMappingURL=loyalty.js.map