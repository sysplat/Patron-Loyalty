"use strict";
/**
 * Tenant staff ActivityLog actions for Patron Loyalty.
 * Keep each action ≤ 50 chars (ActivityLog.action VarChar(50)).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOYALTY_ACTIVITY_ACTION_LABELS = exports.LOYALTY_ACTIVITY_RESOURCE_TYPES = exports.LOYALTY_ACTIVITY_ACTIONS = void 0;
exports.loyaltyActivityActionLabel = loyaltyActivityActionLabel;
exports.LOYALTY_ACTIVITY_ACTIONS = {
    POINTS_ADJUSTED: 'loyalty.points.adjusted',
    POINTS_EARNED_PURCHASE: 'loyalty.points.earned_purchase',
    REWARD_REDEEMED: 'loyalty.reward.redeemed',
    REDEMPTION_FULFILLED: 'loyalty.redemption.fulfilled',
    REDEMPTION_CANCELLED: 'loyalty.redemption.cancelled',
    WALLET_ADJUSTED: 'loyalty.wallet.adjusted',
    GIFT_CARD_ISSUED: 'loyalty.gift_card.issued',
    GIFT_CARD_DELETED: 'loyalty.gift_card.deleted',
    PROGRAM_UPDATED: 'loyalty.program.updated',
    TIER_CREATED: 'loyalty.tier.created',
    EARN_RULE_CREATED: 'loyalty.earn_rule.created',
    EARN_RULE_UPDATED: 'loyalty.earn_rule.updated',
    REWARD_CREATED: 'loyalty.reward.created',
    REWARD_UPDATED: 'loyalty.reward.updated',
    REWARD_DELETED: 'loyalty.reward.deleted',
    COUPON_CREATED: 'loyalty.coupon.created',
    COUPON_DELETED: 'loyalty.coupon.deleted',
    CAMPAIGN_CREATED: 'loyalty.campaign.created',
    CAMPAIGN_UPDATED: 'loyalty.campaign.updated',
    CAMPAIGN_DELETED: 'loyalty.campaign.deleted',
    CAMPAIGN_LAUNCHED: 'loyalty.campaign.launched',
    API_KEY_ROTATED: 'loyalty.api_key.rotated',
    API_KEY_REVOKED: 'loyalty.api_key.revoked',
    PATRONS_CSV_IMPORTED: 'loyalty.patrons.csv_imported',
    ORG_UPDATED: 'loyalty.org.updated',
};
exports.LOYALTY_ACTIVITY_RESOURCE_TYPES = {
    LOYALTY_ACCOUNT: 'loyalty_account',
    LOYALTY_REDEMPTION: 'loyalty_redemption',
    LOYALTY_WALLET: 'loyalty_wallet',
    LOYALTY_GIFT_CARD: 'loyalty_gift_card',
    LOYALTY_PROGRAM: 'loyalty_program',
    LOYALTY_TIER: 'loyalty_tier',
    LOYALTY_EARN_RULE: 'loyalty_earn_rule',
    LOYALTY_REWARD: 'loyalty_reward',
    LOYALTY_COUPON: 'loyalty_coupon',
    LOYALTY_CAMPAIGN: 'loyalty_campaign',
    LOYALTY_API_KEY: 'loyalty_api_key',
    CUSTOMER: 'customer',
    ORGANIZATION: 'organization',
};
/** Human labels for staff Activity UI. */
exports.LOYALTY_ACTIVITY_ACTION_LABELS = {
    [exports.LOYALTY_ACTIVITY_ACTIONS.POINTS_ADJUSTED]: 'Adjusted points',
    [exports.LOYALTY_ACTIVITY_ACTIONS.POINTS_EARNED_PURCHASE]: 'Recorded purchase earn',
    [exports.LOYALTY_ACTIVITY_ACTIONS.REWARD_REDEEMED]: 'Redeemed reward',
    [exports.LOYALTY_ACTIVITY_ACTIONS.REDEMPTION_FULFILLED]: 'Fulfilled redemption',
    [exports.LOYALTY_ACTIVITY_ACTIONS.REDEMPTION_CANCELLED]: 'Cancelled redemption',
    [exports.LOYALTY_ACTIVITY_ACTIONS.WALLET_ADJUSTED]: 'Adjusted wallet balance',
    [exports.LOYALTY_ACTIVITY_ACTIONS.GIFT_CARD_ISSUED]: 'Issued gift card',
    [exports.LOYALTY_ACTIVITY_ACTIONS.GIFT_CARD_DELETED]: 'Deleted gift card',
    [exports.LOYALTY_ACTIVITY_ACTIONS.PROGRAM_UPDATED]: 'Updated program',
    [exports.LOYALTY_ACTIVITY_ACTIONS.TIER_CREATED]: 'Created tier',
    [exports.LOYALTY_ACTIVITY_ACTIONS.EARN_RULE_CREATED]: 'Created earn rule',
    [exports.LOYALTY_ACTIVITY_ACTIONS.EARN_RULE_UPDATED]: 'Updated earn rule',
    [exports.LOYALTY_ACTIVITY_ACTIONS.REWARD_CREATED]: 'Created reward',
    [exports.LOYALTY_ACTIVITY_ACTIONS.REWARD_UPDATED]: 'Updated reward',
    [exports.LOYALTY_ACTIVITY_ACTIONS.REWARD_DELETED]: 'Deleted reward',
    [exports.LOYALTY_ACTIVITY_ACTIONS.COUPON_CREATED]: 'Created promo code',
    [exports.LOYALTY_ACTIVITY_ACTIONS.COUPON_DELETED]: 'Deleted promo code',
    [exports.LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_CREATED]: 'Created campaign',
    [exports.LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_UPDATED]: 'Updated campaign',
    [exports.LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_DELETED]: 'Deleted campaign',
    [exports.LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_LAUNCHED]: 'Launched campaign',
    [exports.LOYALTY_ACTIVITY_ACTIONS.API_KEY_ROTATED]: 'Rotated API key',
    [exports.LOYALTY_ACTIVITY_ACTIONS.API_KEY_REVOKED]: 'Revoked API key',
    [exports.LOYALTY_ACTIVITY_ACTIONS.PATRONS_CSV_IMPORTED]: 'Imported patrons CSV',
    [exports.LOYALTY_ACTIVITY_ACTIONS.ORG_UPDATED]: 'Updated business profile',
};
function loyaltyActivityActionLabel(action) {
    return (exports.LOYALTY_ACTIVITY_ACTION_LABELS[action] ??
        action.replace(/^loyalty\./, '').replaceAll('.', ' '));
}
//# sourceMappingURL=loyalty-activity.js.map