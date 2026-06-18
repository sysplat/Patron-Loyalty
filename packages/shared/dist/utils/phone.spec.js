"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const phone_1 = require("./phone");
(0, vitest_1.describe)('normalizeSmsRecipient', () => {
    (0, vitest_1.it)('keeps valid E.164 numbers', () => {
        (0, vitest_1.expect)((0, phone_1.normalizeSmsRecipient)('+14155552671')).toBe('+14155552671');
    });
    (0, vitest_1.it)('removes common formatting from E.164 numbers', () => {
        (0, vitest_1.expect)((0, phone_1.normalizeSmsRecipient)('+1 (415) 555-2671')).toBe('+14155552671');
    });
    (0, vitest_1.it)('normalizes Canadian and US local numbers to +1', () => {
        (0, vitest_1.expect)((0, phone_1.normalizeSmsRecipient)('(415) 555-2671')).toBe('+14155552671');
        (0, vitest_1.expect)((0, phone_1.normalizeSmsRecipient)('14155552671')).toBe('+14155552671');
    });
    (0, vitest_1.it)('normalizes 00 international prefixes to E.164', () => {
        (0, vitest_1.expect)((0, phone_1.normalizeSmsRecipient)('00442079460000')).toBe('+442079460000');
    });
    (0, vitest_1.it)('rejects ambiguous or invalid numbers', () => {
        (0, vitest_1.expect)((0, phone_1.normalizeSmsRecipient)('604861')).toBeNull();
        (0, vitest_1.expect)((0, phone_1.normalizeSmsRecipient)('442079460000')).toBeNull();
        (0, vitest_1.expect)((0, phone_1.normalizeSmsRecipient)('')).toBeNull();
    });
});
//# sourceMappingURL=phone.spec.js.map