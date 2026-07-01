import { z } from 'zod';
import { LOYALTY_POS_PROVIDERS } from '../constants/loyalty-pos';

export const loyaltySquareConnectionSchema = z.object({
  /** Square Location ID (starts with "L") */
  locationId: z.string().min(1).max(60),
  /** Square access token — encrypted at rest, never returned to client */
  accessToken: z.string().min(10).max(500),
  /**
   * Square webhook signature key — found in Square Dashboard → Webhooks.
   * Used to verify `x-square-hmacsha256-signature` on inbound webhooks.
   */
  webhookSignatureKey: z.string().min(10).max(500),
});

export type LoyaltySquareConnectionInput = z.infer<typeof loyaltySquareConnectionSchema>;

export const loyaltyCloverConnectionSchema = z.object({
  /** Clover Merchant ID */
  merchantId: z.string().min(1).max(60),
  /** Clover access token — encrypted at rest, never returned to client */
  accessToken: z.string().min(10).max(500),
  /**
   * Clover webhook shared secret — configured in Clover Developer Dashboard.
   * Used to verify `x-clover-signature` on inbound webhooks.
   */
  webhookSignatureKey: z.string().min(10).max(500),
});

export type LoyaltyCloverConnectionInput = z.infer<typeof loyaltyCloverConnectionSchema>;

export const loyaltyPosProviderSchema = z.enum([
  LOYALTY_POS_PROVIDERS.SQUARE,
  LOYALTY_POS_PROVIDERS.CLOVER,
]);
