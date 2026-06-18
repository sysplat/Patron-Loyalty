"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const customer_desk_1 = require("./customer-desk");
(0, vitest_1.describe)('customer-desk', () => {
    (0, vitest_1.it)('normalizes desk numbers', () => {
        (0, vitest_1.expect)((0, customer_desk_1.normalizeCustomerDeskNumber)('2')).toBe('2');
        (0, vitest_1.expect)((0, customer_desk_1.normalizeCustomerDeskNumber)('Desk 3')).toBe('3');
        (0, vitest_1.expect)((0, customer_desk_1.normalizeCustomerDeskNumber)('')).toBeNull();
    });
    (0, vitest_1.it)('formats customer desk labels', () => {
        (0, vitest_1.expect)((0, customer_desk_1.formatCustomerDeskLabel)('1')).toBe('Desk 1');
        (0, vitest_1.expect)((0, customer_desk_1.formatCustomerDeskLabel)(null)).toBeNull();
    });
    (0, vitest_1.it)('formats desk phrases with fallback', () => {
        (0, vitest_1.expect)((0, customer_desk_1.formatCustomerDeskPhrase)('2')).toBe('Desk 2');
        (0, vitest_1.expect)((0, customer_desk_1.formatCustomerDeskPhrase)(undefined)).toBe('the service desk');
    });
    (0, vitest_1.it)('formats desk label with default fallback', () => {
        (0, vitest_1.expect)((0, customer_desk_1.formatDeskLabelOrDefault)('2')).toBe('Desk 2');
        (0, vitest_1.expect)((0, customer_desk_1.formatDeskLabelOrDefault)(undefined)).toBe('Desk');
    });
});
//# sourceMappingURL=customer-desk.spec.js.map