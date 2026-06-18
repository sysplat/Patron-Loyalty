export type SmsCreditPackSlug = 'sms-500' | 'sms-2000' | 'sms-10000';
export interface SmsCreditPackDefinition {
    slug: SmsCreditPackSlug;
    messages: number;
    /** Display / fallback price in USD when Stripe Price ID is not configured */
    priceUsd: number;
    /** Short name shown in billing UI */
    label: string;
    /** One-line description for pack cards */
    description: string;
    /** Env var for Stripe Price ID, e.g. STRIPE_PRICE_SMS_500 */
    stripePriceEnvKey: string;
    /** Optional env var to override message count, e.g. SMS_PACK_SMS_500 */
    messagesEnvKey: string;
}
export declare const SMS_CREDIT_PACKS: SmsCreditPackDefinition[];
/** USD per message for display (e.g. $0.03 / message). */
export declare function smsPackUnitPriceUsd(pack: Pick<SmsCreditPackDefinition, 'messages' | 'priceUsd'>): number;
export declare function getSmsCreditPackBySlug(slug: string): SmsCreditPackDefinition | undefined;
//# sourceMappingURL=sms-credit-packs.d.ts.map