import { z } from 'zod';
export declare const loyaltyKlaviyoConnectionSchema: z.ZodObject<{
    /**
     * Klaviyo Private API Key (starts with "pk_").
     * Found in Klaviyo → Account → Settings → API Keys.
     * Encrypted at rest; never returned to client.
     */
    apiKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
}, {
    apiKey: string;
}>;
export type LoyaltyKlaviyoConnectionInput = z.infer<typeof loyaltyKlaviyoConnectionSchema>;
export declare const loyaltyMailchimpConnectionSchema: z.ZodObject<{
    /**
     * Mailchimp API key (ends with "-usN").
     * Found in Mailchimp → Account → Extras → API Keys.
     * Encrypted at rest; never returned to client.
     */
    apiKey: z.ZodString;
    /**
     * Mailchimp Audience (List) ID — found in Audience → Settings → Audience name and defaults.
     */
    listId: z.ZodString;
    /**
     * Mailchimp data centre suffix (e.g. "us10"), derived from the API key but
     * accepted explicitly to avoid key parsing complexity.
     */
    serverPrefix: z.ZodString;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    listId: string;
    serverPrefix: string;
}, {
    apiKey: string;
    listId: string;
    serverPrefix: string;
}>;
export type LoyaltyMailchimpConnectionInput = z.infer<typeof loyaltyMailchimpConnectionSchema>;
export declare const loyaltyMarketingProviderSchema: z.ZodEnum<["klaviyo", "mailchimp"]>;
//# sourceMappingURL=loyalty-marketing.validators.d.ts.map