export const LOYALTY_POS_PROVIDERS = {
  SQUARE: 'square',
  CLOVER: 'clover',
} as const;

export type LoyaltyPosProvider = (typeof LOYALTY_POS_PROVIDERS)[keyof typeof LOYALTY_POS_PROVIDERS];

export const LOYALTY_POS_PROVIDER_VALUES = Object.values(
  LOYALTY_POS_PROVIDERS,
) as LoyaltyPosProvider[];

/** Square webhook event types we handle */
export const SQUARE_WEBHOOK_EVENTS = {
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_UPDATED: 'payment.updated',
  CUSTOMER_CREATED: 'customer.created',
} as const;

/** Clover webhook event types we handle */
export const CLOVER_WEBHOOK_EVENTS = {
  /** Fired when an order is created/updated — we check for PAID status */
  CREATE_ORDER: 'CREATE:ORDER',
  UPDATE_ORDER: 'UPDATE:ORDER',
  CREATE_CUSTOMER: 'CREATE:CUSTOMER',
} as const;
