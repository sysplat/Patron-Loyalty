"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMS_CREDIT_PACKS = void 0;
exports.smsPackUnitPriceUsd = smsPackUnitPriceUsd;
exports.getSmsCreditPackBySlug = getSmsCreditPackBySlug;
/** Volume-tier retail unit prices (USD per billable message). */
const SMS_PACK_UNIT_USD = {
    'sms-500': 0.03,
    'sms-2000': 0.0275,
    'sms-10000': 0.025,
};
exports.SMS_CREDIT_PACKS = [
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
for (const pack of exports.SMS_CREDIT_PACKS) {
    const unit = SMS_PACK_UNIT_USD[pack.slug];
    pack.priceUsd = Math.round(pack.messages * unit * 100) / 100;
}
/** USD per message for display (e.g. $0.03 / message). */
function smsPackUnitPriceUsd(pack) {
    if (pack.messages <= 0)
        return 0;
    return pack.priceUsd / pack.messages;
}
function getSmsCreditPackBySlug(slug) {
    return exports.SMS_CREDIT_PACKS.find((p) => p.slug === slug);
}
//# sourceMappingURL=sms-credit-packs.js.map