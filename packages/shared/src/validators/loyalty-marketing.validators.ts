import { z } from 'zod';
import { LOYALTY_MARKETING_PROVIDERS } from '../constants/loyalty-marketing';

export const loyaltyKlaviyoConnectionSchema = z.object({
  /**
   * Klaviyo Private API Key (starts with "pk_").
   * Found in Klaviyo → Account → Settings → API Keys.
   * Encrypted at rest; never returned to client.
   */
  apiKey: z.string().min(10).max(500),
});

export type LoyaltyKlaviyoConnectionInput = z.infer<typeof loyaltyKlaviyoConnectionSchema>;

export const loyaltyMailchimpConnectionSchema = z.object({
  /**
   * Mailchimp API key (ends with "-usN").
   * Found in Mailchimp → Account → Extras → API Keys.
   * Encrypted at rest; never returned to client.
   */
  apiKey: z.string().min(10).max(500),
  /**
   * Mailchimp Audience (List) ID — found in Audience → Settings → Audience name and defaults.
   */
  listId: z.string().min(1).max(60),
  /**
   * Mailchimp data centre suffix (e.g. "us10"), derived from the API key but
   * accepted explicitly to avoid key parsing complexity.
   */
  serverPrefix: z.string().min(1).max(10),
});

export type LoyaltyMailchimpConnectionInput = z.infer<typeof loyaltyMailchimpConnectionSchema>;

export const loyaltyMarketingProviderSchema = z.enum([
  LOYALTY_MARKETING_PROVIDERS.KLAVIYO,
  LOYALTY_MARKETING_PROVIDERS.MAILCHIMP,
]);
