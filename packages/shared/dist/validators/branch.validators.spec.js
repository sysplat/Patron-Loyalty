"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const branch_validators_1 = require("./branch.validators");
(0, vitest_1.describe)('createBranchSchema', () => {
    (0, vitest_1.it)('accepts a valid branch payload', () => {
        const result = branch_validators_1.createBranchSchema.safeParse({
            name: 'Downtown',
            timezone: 'America/New_York',
            phone: '+15550001234',
        });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('requires timezone', () => {
        const result = branch_validators_1.createBranchSchema.safeParse({
            name: 'Downtown',
        });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('rejects invalid email addresses', () => {
        const result = branch_validators_1.createBranchSchema.safeParse({
            name: 'Downtown',
            timezone: 'UTC',
            email: 'not-an-email',
        });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
});
(0, vitest_1.describe)('updateBranchCustomerNoticeSchema', () => {
    (0, vitest_1.it)('accepts notice toggle and minutes', () => {
        const result = branch_validators_1.updateBranchCustomerNoticeSchema.safeParse({
            exceptionalCustomerNotice: true,
            exceptionalCustomerNoticeMinutes: 15,
        });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('rejects empty body', () => {
        const result = branch_validators_1.updateBranchCustomerNoticeSchema.safeParse({});
        (0, vitest_1.expect)(result.success).toBe(false);
    });
});
//# sourceMappingURL=branch.validators.spec.js.map