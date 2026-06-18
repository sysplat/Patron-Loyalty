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

/** Volume-tier retail unit prices (USD per billable message). */
const SMS_PACK_UNIT_USD: Record<SmsCreditPackSlug, number> = {
  'sms-500': 0.03,
  'sms-2000': 0.0275,
  'sms-10000': 0.025,
};

export const SMS_CREDIT_PACKS: SmsCreditPackDefinition[] = [
  {
    slug: 'sms-500',
    messages: 500,
    priceUsd: 15,
    label: 'Starter',
    description: 'For light SMS usage — ticket called and appointment confirmations.',
    stripePriceEnvKey: 'STRIPE_PRICE_SMS_500',
    messagesEnvKey: 'SMS_PACK_SMS_500',
  },
  {
    slug: 'sms-2000',
    messages: 2_000,
    priceUsd: 55,
    label: 'Growth',
    description: 'Balanced pack for busy branches with regular customer notifications.',
    stripePriceEnvKey: 'STRIPE_PRICE_SMS_2000',
    messagesEnvKey: 'SMS_PACK_SMS_2000',
  },
  {
    slug: 'sms-10000',
    messages: 10_000,
    priceUsd: 250,
    label: 'Scale',
    description: 'High-volume lifetime allowance for multi-location operations.',
    stripePriceEnvKey: 'STRIPE_PRICE_SMS_10000',
    messagesEnvKey: 'SMS_PACK_SMS_10000',
  },
];

for (const pack of SMS_CREDIT_PACKS) {
  const unit = SMS_PACK_UNIT_USD[pack.slug];
  pack.priceUsd = Math.round(pack.messages * unit * 100) / 100;
}

/** USD per message for display (e.g. $0.03 / message). */
export function smsPackUnitPriceUsd(
  pack: Pick<SmsCreditPackDefinition, 'messages' | 'priceUsd'>,
): number {
  if (pack.messages <= 0) return 0;
  return pack.priceUsd / pack.messages;
}

export function getSmsCreditPackBySlug(slug: string): SmsCreditPackDefinition | undefined {
  return SMS_CREDIT_PACKS.find((p) => p.slug === slug);
}
