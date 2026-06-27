export declare const LOYALTY_POINT_LEDGER_TYPES: {
    readonly EARN: "EARN";
    readonly BURN: "BURN";
    readonly EXPIRE: "EXPIRE";
    readonly BONUS: "BONUS";
    readonly ADJUST: "ADJUST";
};
export type LoyaltyPointLedgerType = (typeof LOYALTY_POINT_LEDGER_TYPES)[keyof typeof LOYALTY_POINT_LEDGER_TYPES];
export declare const LOYALTY_EARN_EVENT_TYPES: {
    readonly TICKET_COMPLETED: "TICKET_COMPLETED";
    readonly APPOINTMENT_COMPLETED: "APPOINTMENT_COMPLETED";
    readonly REVIEW_SUBMITTED: "REVIEW_SUBMITTED";
    readonly REFERRAL_COMPLETED: "REFERRAL_COMPLETED";
    readonly PURCHASE: "PURCHASE";
    readonly MANUAL: "MANUAL";
};
/** Setting key for hashed LMS integration API key (`{ hash, prefix, createdAt }`). */
export declare const LOYALTY_INTEGRATION_API_KEY_SETTING: "loyalty_integration_api_key";
export type LoyaltyEarnEventType = (typeof LOYALTY_EARN_EVENT_TYPES)[keyof typeof LOYALTY_EARN_EVENT_TYPES];
export declare const LOYALTY_REWARD_TYPES: {
    readonly DISCOUNT: "DISCOUNT";
    readonly FREE_ITEM: "FREE_ITEM";
    readonly GIFT: "GIFT";
    readonly SERVICE: "SERVICE";
};
export type LoyaltyRewardType = (typeof LOYALTY_REWARD_TYPES)[keyof typeof LOYALTY_REWARD_TYPES];
export declare const LOYALTY_COUPON_TYPES: {
    readonly PERCENT: "PERCENT";
    readonly FIXED: "FIXED";
    readonly BOGO: "BOGO";
};
export type LoyaltyCouponType = (typeof LOYALTY_COUPON_TYPES)[keyof typeof LOYALTY_COUPON_TYPES];
export declare const LOYALTY_WALLET_TX_TYPES: {
    readonly CREDIT: "CREDIT";
    readonly DEBIT: "DEBIT";
    readonly REFUND: "REFUND";
    readonly CASHBACK: "CASHBACK";
    readonly BONUS: "BONUS";
    readonly GIFT: "GIFT";
};
export type LoyaltyWalletTxType = (typeof LOYALTY_WALLET_TX_TYPES)[keyof typeof LOYALTY_WALLET_TX_TYPES];
export declare const LOYALTY_CAMPAIGN_CHANNELS: {
    readonly SMS: "SMS";
    readonly EMAIL: "EMAIL";
    readonly PUSH: "PUSH";
    readonly WHATSAPP: "WHATSAPP";
    readonly IN_APP: "IN_APP";
};
export type LoyaltyCampaignChannel = (typeof LOYALTY_CAMPAIGN_CHANNELS)[keyof typeof LOYALTY_CAMPAIGN_CHANNELS];
export declare const LOYALTY_CAMPAIGN_TRIGGERS: {
    readonly WELCOME: "WELCOME";
    readonly BIRTHDAY: "BIRTHDAY";
    readonly WIN_BACK: "WIN_BACK";
    readonly TIER_UPGRADE: "TIER_UPGRADE";
    readonly ABANDONED: "ABANDONED";
    readonly MANUAL: "MANUAL";
};
export type LoyaltyCampaignTrigger = (typeof LOYALTY_CAMPAIGN_TRIGGERS)[keyof typeof LOYALTY_CAMPAIGN_TRIGGERS];
export declare const LOYALTY_CAMPAIGN_STATUSES: {
    readonly DRAFT: "draft";
    readonly SCHEDULED: "scheduled";
    readonly ACTIVE: "active";
    readonly PAUSED: "paused";
    readonly COMPLETED: "completed";
};
export declare const LOYALTY_DEFAULT_TIERS: readonly [{
    readonly slug: "bronze";
    readonly name: "Bronze";
    readonly minLifetimePoints: 0;
    readonly sortOrder: 0;
    readonly color: "#CD7F32";
}, {
    readonly slug: "silver";
    readonly name: "Silver";
    readonly minLifetimePoints: 500;
    readonly sortOrder: 1;
    readonly color: "#C0C0C0";
}, {
    readonly slug: "gold";
    readonly name: "Gold";
    readonly minLifetimePoints: 1500;
    readonly sortOrder: 2;
    readonly color: "#FFD700";
}, {
    readonly slug: "platinum";
    readonly name: "Platinum";
    readonly minLifetimePoints: 5000;
    readonly sortOrder: 3;
    readonly color: "#E5E4E2";
}, {
    readonly slug: "diamond";
    readonly name: "Diamond";
    readonly minLifetimePoints: 10000;
    readonly sortOrder: 4;
    readonly color: "#B9F2FF";
}];
export declare const LOYALTY_DEFAULT_EARN_RULES: readonly [{
    readonly eventType: "TICKET_COMPLETED";
    readonly name: "Visit completed";
    readonly points: 10;
}, {
    readonly eventType: "APPOINTMENT_COMPLETED";
    readonly name: "Appointment completed";
    readonly points: 15;
}, {
    readonly eventType: "REVIEW_SUBMITTED";
    readonly name: "Review submitted";
    readonly points: 5;
}, {
    readonly eventType: "PURCHASE";
    readonly name: "Purchase (1 pt per dollar)";
    readonly points: 1;
}, {
    readonly eventType: "MANUAL";
    readonly name: "Manual / POS";
    readonly points: 0;
}];
/** Visits required for one digital stamp-card cycle (SRS §13). */
export declare const LOYALTY_STAMP_CARD_TARGET = 10;
export declare const LOYALTY_CHALLENGE_TARGET_TYPES: {
    readonly VISITS: "VISITS";
    readonly POINTS_EARNED: "POINTS_EARNED";
    readonly REFERRALS: "REFERRALS";
};
export declare const CRM_TASK_STATUSES: {
    readonly OPEN: "open";
    readonly IN_PROGRESS: "in_progress";
    readonly DONE: "done";
    readonly CANCELLED: "cancelled";
};
export declare const CRM_SUPPORT_TICKET_PRIORITIES: {
    readonly LOW: "low";
    readonly NORMAL: "normal";
    readonly HIGH: "high";
    readonly URGENT: "urgent";
};
export declare const CRM_SUPPORT_TICKET_STATUSES: {
    readonly OPEN: "open";
    readonly PENDING: "pending";
    readonly RESOLVED: "resolved";
    readonly CLOSED: "closed";
};
export declare const CRM_SALES_STAGES: {
    readonly LEAD: "lead";
    readonly QUALIFIED: "qualified";
    readonly PROPOSAL: "proposal";
    readonly NEGOTIATION: "negotiation";
    readonly WON: "won";
    readonly LOST: "lost";
};
export declare const LOYALTY_PATRON_GAME_TYPES: {
    readonly SPIN_WHEEL: "spin_wheel";
    readonly SCRATCH_CARD: "scratch_card";
};
export type LoyaltyPatronGameType = (typeof LOYALTY_PATRON_GAME_TYPES)[keyof typeof LOYALTY_PATRON_GAME_TYPES];
/** Earn-rule condition keys stored in LoyaltyEarnRule.conditions JSON (SRS §6 rule builder). */
export interface LoyaltyEarnRuleConditions {
    minPurchaseCents?: number;
    branchId?: string;
    tierSlugs?: string[];
    minLifetimePoints?: number;
}
export declare const LOYALTY_EVENTS: {
    readonly TICKET_COMPLETED: "loyalty.ticket.completed";
    readonly TICKET_NO_SHOW: "loyalty.ticket.no_show";
    readonly APPOINTMENT_COMPLETED: "loyalty.appointment.completed";
    readonly APPOINTMENT_NO_SHOW: "loyalty.appointment.no_show";
    readonly REVIEW_SUBMITTED: "loyalty.review.submitted";
    readonly CUSTOMER_CREATED: "loyalty.customer.created";
    readonly TIER_UPGRADED: "loyalty.tier.upgraded";
    readonly POINTS_EARNED: "loyalty.points.earned";
    readonly POINTS_REDEEMED: "loyalty.points.redeemed";
};
/** Tenant webhook event types for outbound LMS integrations. */
export declare const LOYALTY_WEBHOOK_EVENTS: {
    readonly CUSTOMER_CREATED: "loyalty.customer.created";
    readonly POINTS_EARNED: "loyalty.points.earned";
    readonly POINTS_REDEEMED: "loyalty.points.redeemed";
    readonly TIER_UPGRADED: "loyalty.tier.upgraded";
    readonly VISIT_NO_SHOW: "loyalty.visit.no_show";
    readonly REWARD_REDEEMED: "loyalty.reward.redeemed";
};
//# sourceMappingURL=loyalty.d.ts.map