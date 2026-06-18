"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const sms_credits_1 = require("./sms-credits");
const sms_credit_packs_1 = require("./sms-credit-packs");
(0, vitest_1.describe)('isBillableSmsProviderMessageId', () => {
    (0, vitest_1.it)('accepts Twilio SMS SIDs', () => {
        (0, vitest_1.expect)((0, sms_credits_1.isBillableSmsProviderMessageId)('SMec73bf6b49d2ec2b2666061346442450')).toBe(true);
    });
    (0, vitest_1.it)('rejects dev/console and missing ids', () => {
        (0, vitest_1.expect)((0, sms_credits_1.isBillableSmsProviderMessageId)('dev-123')).toBe(false);
        (0, vitest_1.expect)((0, sms_credits_1.isBillableSmsProviderMessageId)('push-noop')).toBe(false);
        (0, vitest_1.expect)((0, sms_credits_1.isBillableSmsProviderMessageId)(null)).toBe(false);
    });
});
(0, vitest_1.describe)('SMS_CREDIT_PACKS pricing', () => {
    (0, vitest_1.it)('keeps retail above wholesale on every tier', () => {
        for (const pack of sms_credit_packs_1.SMS_CREDIT_PACKS) {
            const unit = (0, sms_credit_packs_1.smsPackUnitPriceUsd)(pack);
            (0, vitest_1.expect)(unit).toBeGreaterThanOrEqual(0.025);
            (0, vitest_1.expect)(unit).toBeLessThanOrEqual(0.03);
        }
    });
});
//# sourceMappingURL=sms-credits.spec.js.map