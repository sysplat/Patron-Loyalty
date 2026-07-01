"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loyaltyPosProviderSchema = exports.loyaltyCloverConnectionSchema = exports.loyaltySquareConnectionSchema = void 0;
const zod_1 = require("zod");
const loyalty_pos_1 = require("../constants/loyalty-pos");
exports.loyaltySquareConnectionSchema = zod_1.z.object({
    /** Square Location ID (starts with "L") */
    locationId: zod_1.z.string().min(1).max(60),
    /** Square access token — encrypted at rest, never returned to client */
    accessToken: zod_1.z.string().min(10).max(500),
    /**
     * Square webhook signature key — found in Square Dashboard → Webhooks.
     * Used to verify `x-square-hmacsha256-signature` on inbound webhooks.
     */
    webhookSignatureKey: zod_1.z.string().min(10).max(500),
});
exports.loyaltyCloverConnectionSchema = zod_1.z.object({
    /** Clover Merchant ID */
    merchantId: zod_1.z.string().min(1).max(60),
    /** Clover access token — encrypted at rest, never returned to client */
    accessToken: zod_1.z.string().min(10).max(500),
    /**
     * Clover webhook shared secret — configured in Clover Developer Dashboard.
     * Used to verify `x-clover-signature` on inbound webhooks.
     */
    webhookSignatureKey: zod_1.z.string().min(10).max(500),
});
exports.loyaltyPosProviderSchema = zod_1.z.enum([
    loyalty_pos_1.LOYALTY_POS_PROVIDERS.SQUARE,
    loyalty_pos_1.LOYALTY_POS_PROVIDERS.CLOVER,
]);
//# sourceMappingURL=loyalty-pos.validators.js.map