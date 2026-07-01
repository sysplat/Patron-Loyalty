"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loyaltyMarketingProviderSchema = exports.loyaltyMailchimpConnectionSchema = exports.loyaltyKlaviyoConnectionSchema = void 0;
const zod_1 = require("zod");
const loyalty_marketing_1 = require("../constants/loyalty-marketing");
exports.loyaltyKlaviyoConnectionSchema = zod_1.z.object({
    /**
     * Klaviyo Private API Key (starts with "pk_").
     * Found in Klaviyo → Account → Settings → API Keys.
     * Encrypted at rest; never returned to client.
     */
    apiKey: zod_1.z.string().min(10).max(500),
});
exports.loyaltyMailchimpConnectionSchema = zod_1.z.object({
    /**
     * Mailchimp API key (ends with "-usN").
     * Found in Mailchimp → Account → Extras → API Keys.
     * Encrypted at rest; never returned to client.
     */
    apiKey: zod_1.z.string().min(10).max(500),
    /**
     * Mailchimp Audience (List) ID — found in Audience → Settings → Audience name and defaults.
     */
    listId: zod_1.z.string().min(1).max(60),
    /**
     * Mailchimp data centre suffix (e.g. "us10"), derived from the API key but
     * accepted explicitly to avoid key parsing complexity.
     */
    serverPrefix: zod_1.z.string().min(1).max(10),
});
exports.loyaltyMarketingProviderSchema = zod_1.z.enum([
    loyalty_marketing_1.LOYALTY_MARKETING_PROVIDERS.KLAVIYO,
    loyalty_marketing_1.LOYALTY_MARKETING_PROVIDERS.MAILCHIMP,
]);
//# sourceMappingURL=loyalty-marketing.validators.js.map