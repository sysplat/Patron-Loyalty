/**
 * Tenant staff ActivityLog actions for Patron Loyalty.
 * Keep each action ≤ 50 chars (ActivityLog.action VarChar(50)).
 */
export declare const LOYALTY_ACTIVITY_ACTIONS: {
    readonly POINTS_ADJUSTED: "loyalty.points.adjusted";
    readonly POINTS_EARNED_PURCHASE: "loyalty.points.earned_purchase";
    readonly REWARD_REDEEMED: "loyalty.reward.redeemed";
    readonly REDEMPTION_FULFILLED: "loyalty.redemption.fulfilled";
    readonly REDEMPTION_CANCELLED: "loyalty.redemption.cancelled";
    readonly WALLET_ADJUSTED: "loyalty.wallet.adjusted";
    readonly GIFT_CARD_ISSUED: "loyalty.gift_card.issued";
    readonly GIFT_CARD_DELETED: "loyalty.gift_card.deleted";
    readonly PROGRAM_UPDATED: "loyalty.program.updated";
    readonly TIER_CREATED: "loyalty.tier.created";
    readonly EARN_RULE_CREATED: "loyalty.earn_rule.created";
    readonly EARN_RULE_UPDATED: "loyalty.earn_rule.updated";
    readonly REWARD_CREATED: "loyalty.reward.created";
    readonly REWARD_UPDATED: "loyalty.reward.updated";
    readonly REWARD_DELETED: "loyalty.reward.deleted";
    readonly COUPON_CREATED: "loyalty.coupon.created";
    readonly COUPON_DELETED: "loyalty.coupon.deleted";
    readonly CAMPAIGN_CREATED: "loyalty.campaign.created";
    readonly CAMPAIGN_UPDATED: "loyalty.campaign.updated";
    readonly CAMPAIGN_DELETED: "loyalty.campaign.deleted";
    readonly CAMPAIGN_LAUNCHED: "loyalty.campaign.launched";
    readonly API_KEY_ROTATED: "loyalty.api_key.rotated";
    readonly API_KEY_REVOKED: "loyalty.api_key.revoked";
    readonly PATRONS_CSV_IMPORTED: "loyalty.patrons.csv_imported";
    readonly ORG_UPDATED: "loyalty.org.updated";
};
export type LoyaltyActivityAction = (typeof LOYALTY_ACTIVITY_ACTIONS)[keyof typeof LOYALTY_ACTIVITY_ACTIONS];
export declare const LOYALTY_ACTIVITY_RESOURCE_TYPES: {
    readonly LOYALTY_ACCOUNT: "loyalty_account";
    readonly LOYALTY_REDEMPTION: "loyalty_redemption";
    readonly LOYALTY_WALLET: "loyalty_wallet";
    readonly LOYALTY_GIFT_CARD: "loyalty_gift_card";
    readonly LOYALTY_PROGRAM: "loyalty_program";
    readonly LOYALTY_TIER: "loyalty_tier";
    readonly LOYALTY_EARN_RULE: "loyalty_earn_rule";
    readonly LOYALTY_REWARD: "loyalty_reward";
    readonly LOYALTY_COUPON: "loyalty_coupon";
    readonly LOYALTY_CAMPAIGN: "loyalty_campaign";
    readonly LOYALTY_API_KEY: "loyalty_api_key";
    readonly CUSTOMER: "customer";
    readonly ORGANIZATION: "organization";
};
export type LoyaltyActivityResourceType = (typeof LOYALTY_ACTIVITY_RESOURCE_TYPES)[keyof typeof LOYALTY_ACTIVITY_RESOURCE_TYPES];
/** Human labels for staff Activity UI. */
export declare const LOYALTY_ACTIVITY_ACTION_LABELS: Record<LoyaltyActivityAction, string>;
export declare function loyaltyActivityActionLabel(action: string): string;
//# sourceMappingURL=loyalty-activity.d.ts.map