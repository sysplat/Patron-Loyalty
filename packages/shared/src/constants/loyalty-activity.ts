/**
 * Tenant staff ActivityLog actions for Patron Loyalty.
 * Keep each action ≤ 50 chars (ActivityLog.action VarChar(50)).
 */

export const LOYALTY_ACTIVITY_ACTIONS = {
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
} as const;

export type LoyaltyActivityAction =
  (typeof LOYALTY_ACTIVITY_ACTIONS)[keyof typeof LOYALTY_ACTIVITY_ACTIONS];

export const LOYALTY_ACTIVITY_RESOURCE_TYPES = {
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
} as const;

export type LoyaltyActivityResourceType =
  (typeof LOYALTY_ACTIVITY_RESOURCE_TYPES)[keyof typeof LOYALTY_ACTIVITY_RESOURCE_TYPES];

/** Human labels for staff Activity UI. */
export const LOYALTY_ACTIVITY_ACTION_LABELS: Record<LoyaltyActivityAction, string> = {
  [LOYALTY_ACTIVITY_ACTIONS.POINTS_ADJUSTED]: 'Adjusted points',
  [LOYALTY_ACTIVITY_ACTIONS.POINTS_EARNED_PURCHASE]: 'Recorded purchase earn',
  [LOYALTY_ACTIVITY_ACTIONS.REWARD_REDEEMED]: 'Redeemed reward',
  [LOYALTY_ACTIVITY_ACTIONS.REDEMPTION_FULFILLED]: 'Fulfilled redemption',
  [LOYALTY_ACTIVITY_ACTIONS.REDEMPTION_CANCELLED]: 'Cancelled redemption',
  [LOYALTY_ACTIVITY_ACTIONS.WALLET_ADJUSTED]: 'Adjusted wallet balance',
  [LOYALTY_ACTIVITY_ACTIONS.GIFT_CARD_ISSUED]: 'Issued gift card',
  [LOYALTY_ACTIVITY_ACTIONS.GIFT_CARD_DELETED]: 'Deleted gift card',
  [LOYALTY_ACTIVITY_ACTIONS.PROGRAM_UPDATED]: 'Updated program',
  [LOYALTY_ACTIVITY_ACTIONS.TIER_CREATED]: 'Created tier',
  [LOYALTY_ACTIVITY_ACTIONS.EARN_RULE_CREATED]: 'Created earn rule',
  [LOYALTY_ACTIVITY_ACTIONS.EARN_RULE_UPDATED]: 'Updated earn rule',
  [LOYALTY_ACTIVITY_ACTIONS.REWARD_CREATED]: 'Created reward',
  [LOYALTY_ACTIVITY_ACTIONS.REWARD_UPDATED]: 'Updated reward',
  [LOYALTY_ACTIVITY_ACTIONS.REWARD_DELETED]: 'Deleted reward',
  [LOYALTY_ACTIVITY_ACTIONS.COUPON_CREATED]: 'Created promo code',
  [LOYALTY_ACTIVITY_ACTIONS.COUPON_DELETED]: 'Deleted promo code',
  [LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_CREATED]: 'Created campaign',
  [LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_UPDATED]: 'Updated campaign',
  [LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_DELETED]: 'Deleted campaign',
  [LOYALTY_ACTIVITY_ACTIONS.CAMPAIGN_LAUNCHED]: 'Launched campaign',
  [LOYALTY_ACTIVITY_ACTIONS.API_KEY_ROTATED]: 'Rotated API key',
  [LOYALTY_ACTIVITY_ACTIONS.API_KEY_REVOKED]: 'Revoked API key',
  [LOYALTY_ACTIVITY_ACTIONS.PATRONS_CSV_IMPORTED]: 'Imported patrons CSV',
  [LOYALTY_ACTIVITY_ACTIONS.ORG_UPDATED]: 'Updated business profile',
};

export function loyaltyActivityActionLabel(action: string): string {
  return (
    LOYALTY_ACTIVITY_ACTION_LABELS[action as LoyaltyActivityAction] ??
    action.replace(/^loyalty\./, '').replaceAll('.', ' ')
  );
}
