export const LOYALTY_POINT_LEDGER_TYPES = {
  EARN: 'EARN',
  BURN: 'BURN',
  EXPIRE: 'EXPIRE',
  BONUS: 'BONUS',
  ADJUST: 'ADJUST',
} as const;

export type LoyaltyPointLedgerType =
  (typeof LOYALTY_POINT_LEDGER_TYPES)[keyof typeof LOYALTY_POINT_LEDGER_TYPES];

export const LOYALTY_EARN_EVENT_TYPES = {
  TICKET_COMPLETED: 'TICKET_COMPLETED',
  APPOINTMENT_COMPLETED: 'APPOINTMENT_COMPLETED',
  REVIEW_SUBMITTED: 'REVIEW_SUBMITTED',
  REFERRAL_COMPLETED: 'REFERRAL_COMPLETED',
  PURCHASE: 'PURCHASE',
  MANUAL: 'MANUAL',
} as const;

/** Setting key for hashed LMS integration API key (`{ hash, prefix, createdAt }`). */
export const LOYALTY_INTEGRATION_API_KEY_SETTING = 'loyalty_integration_api_key' as const;

export type LoyaltyEarnEventType =
  (typeof LOYALTY_EARN_EVENT_TYPES)[keyof typeof LOYALTY_EARN_EVENT_TYPES];

export const LOYALTY_REWARD_TYPES = {
  DISCOUNT: 'DISCOUNT',
  FREE_ITEM: 'FREE_ITEM',
  GIFT: 'GIFT',
  SERVICE: 'SERVICE',
} as const;

export type LoyaltyRewardType = (typeof LOYALTY_REWARD_TYPES)[keyof typeof LOYALTY_REWARD_TYPES];

export const LOYALTY_COUPON_TYPES = {
  PERCENT: 'PERCENT',
  FIXED: 'FIXED',
  BOGO: 'BOGO',
} as const;

export type LoyaltyCouponType = (typeof LOYALTY_COUPON_TYPES)[keyof typeof LOYALTY_COUPON_TYPES];

export const LOYALTY_WALLET_TX_TYPES = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  REFUND: 'REFUND',
  CASHBACK: 'CASHBACK',
  BONUS: 'BONUS',
  GIFT: 'GIFT',
} as const;

export type LoyaltyWalletTxType =
  (typeof LOYALTY_WALLET_TX_TYPES)[keyof typeof LOYALTY_WALLET_TX_TYPES];

export const LOYALTY_CAMPAIGN_CHANNELS = {
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
  WHATSAPP: 'WHATSAPP',
  IN_APP: 'IN_APP',
} as const;

export type LoyaltyCampaignChannel =
  (typeof LOYALTY_CAMPAIGN_CHANNELS)[keyof typeof LOYALTY_CAMPAIGN_CHANNELS];

export const LOYALTY_CAMPAIGN_TRIGGERS = {
  WELCOME: 'WELCOME',
  BIRTHDAY: 'BIRTHDAY',
  WIN_BACK: 'WIN_BACK',
  TIER_UPGRADE: 'TIER_UPGRADE',
  ABANDONED: 'ABANDONED',
  MANUAL: 'MANUAL',
} as const;

export type LoyaltyCampaignTrigger =
  (typeof LOYALTY_CAMPAIGN_TRIGGERS)[keyof typeof LOYALTY_CAMPAIGN_TRIGGERS];

export const LOYALTY_CAMPAIGN_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;

export const LOYALTY_DEFAULT_TIERS = [
  { slug: 'bronze', name: 'Bronze', minLifetimePoints: 0, sortOrder: 0, color: '#CD7F32' },
  { slug: 'silver', name: 'Silver', minLifetimePoints: 500, sortOrder: 1, color: '#C0C0C0' },
  { slug: 'gold', name: 'Gold', minLifetimePoints: 1500, sortOrder: 2, color: '#FFD700' },
  { slug: 'platinum', name: 'Platinum', minLifetimePoints: 5000, sortOrder: 3, color: '#E5E4E2' },
  { slug: 'diamond', name: 'Diamond', minLifetimePoints: 10000, sortOrder: 4, color: '#B9F2FF' },
] as const;

export const LOYALTY_DEFAULT_EARN_RULES = [
  { eventType: LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED, name: 'Visit completed', points: 10 },
  {
    eventType: LOYALTY_EARN_EVENT_TYPES.APPOINTMENT_COMPLETED,
    name: 'Appointment completed',
    points: 15,
  },
  { eventType: LOYALTY_EARN_EVENT_TYPES.REVIEW_SUBMITTED, name: 'Review submitted', points: 5 },
  {
    eventType: LOYALTY_EARN_EVENT_TYPES.PURCHASE,
    name: 'Purchase (1 pt per dollar)',
    points: 1,
  },
  { eventType: LOYALTY_EARN_EVENT_TYPES.MANUAL, name: 'Manual / POS', points: 0 },
] as const;

/** Visits required for one digital stamp-card cycle (SRS §13). */
export const LOYALTY_STAMP_CARD_TARGET = 10;

export const LOYALTY_CHALLENGE_TARGET_TYPES = {
  VISITS: 'VISITS',
  POINTS_EARNED: 'POINTS_EARNED',
  REFERRALS: 'REFERRALS',
} as const;

export const CRM_TASK_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled',
} as const;

export const CRM_SUPPORT_TICKET_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const CRM_SUPPORT_TICKET_STATUSES = {
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export const CRM_SALES_STAGES = {
  LEAD: 'lead',
  QUALIFIED: 'qualified',
  PROPOSAL: 'proposal',
  NEGOTIATION: 'negotiation',
  WON: 'won',
  LOST: 'lost',
} as const;

export const LOYALTY_PATRON_GAME_TYPES = {
  SPIN_WHEEL: 'spin_wheel',
  SCRATCH_CARD: 'scratch_card',
} as const;

export type LoyaltyPatronGameType =
  (typeof LOYALTY_PATRON_GAME_TYPES)[keyof typeof LOYALTY_PATRON_GAME_TYPES];

/** Earn-rule condition keys stored in LoyaltyEarnRule.conditions JSON (SRS §6 rule builder). */
export interface LoyaltyEarnRuleConditions {
  minPurchaseCents?: number;
  branchId?: string;
  tierSlugs?: string[];
  minLifetimePoints?: number;
}

export const LOYALTY_EVENTS = {
  TICKET_COMPLETED: 'loyalty.ticket.completed',
  TICKET_NO_SHOW: 'loyalty.ticket.no_show',
  APPOINTMENT_COMPLETED: 'loyalty.appointment.completed',
  APPOINTMENT_NO_SHOW: 'loyalty.appointment.no_show',
  REVIEW_SUBMITTED: 'loyalty.review.submitted',
  CUSTOMER_CREATED: 'loyalty.customer.created',
  TIER_UPGRADED: 'loyalty.tier.upgraded',
  POINTS_EARNED: 'loyalty.points.earned',
  POINTS_REDEEMED: 'loyalty.points.redeemed',
} as const;

/** Tenant webhook event types for outbound LMS integrations. */
export const LOYALTY_WEBHOOK_EVENTS = {
  CUSTOMER_CREATED: 'loyalty.customer.created',
  POINTS_EARNED: 'loyalty.points.earned',
  POINTS_REDEEMED: 'loyalty.points.redeemed',
  TIER_UPGRADED: 'loyalty.tier.upgraded',
  VISIT_NO_SHOW: 'loyalty.visit.no_show',
  REWARD_REDEEMED: 'loyalty.reward.redeemed',
} as const;
