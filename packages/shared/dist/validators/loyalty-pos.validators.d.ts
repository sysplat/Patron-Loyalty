import { z } from 'zod';
export declare const loyaltySquareConnectionSchema: z.ZodObject<{
    /** Square Location ID (starts with "L") */
    locationId: z.ZodString;
    /** Square access token — encrypted at rest, never returned to client */
    accessToken: z.ZodString;
    /**
     * Square webhook signature key — found in Square Dashboard → Webhooks.
     * Used to verify `x-square-hmacsha256-signature` on inbound webhooks.
     */
    webhookSignatureKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    locationId: string;
    accessToken: string;
    webhookSignatureKey: string;
}, {
    locationId: string;
    accessToken: string;
    webhookSignatureKey: string;
}>;
export type LoyaltySquareConnectionInput = z.infer<typeof loyaltySquareConnectionSchema>;
export declare const loyaltyCloverConnectionSchema: z.ZodObject<{
    /** Clover Merchant ID */
    merchantId: z.ZodString;
    /** Clover access token — encrypted at rest, never returned to client */
    accessToken: z.ZodString;
    /**
     * Clover webhook shared secret — configured in Clover Developer Dashboard.
     * Used to verify `x-clover-signature` on inbound webhooks.
     */
    webhookSignatureKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
    webhookSignatureKey: string;
    merchantId: string;
}, {
    accessToken: string;
    webhookSignatureKey: string;
    merchantId: string;
}>;
export type LoyaltyCloverConnectionInput = z.infer<typeof loyaltyCloverConnectionSchema>;
export declare const loyaltyPosProviderSchema: z.ZodEnum<["square", "clover"]>;
//# sourceMappingURL=loyalty-pos.validators.d.ts.map