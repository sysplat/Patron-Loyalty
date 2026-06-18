"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const auth_validators_1 = require("./auth.validators");
const validBase = {
    businessName: 'Acme Corp',
    email: 'owner@acme.com',
    password: 'SecurePass1',
};
(0, vitest_1.describe)('registerSchema', () => {
    (0, vitest_1.it)('accepts registration when acceptLegal is true', () => {
        const result = auth_validators_1.registerSchema.safeParse({ ...validBase, acceptLegal: true });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('rejects registration when acceptLegal is missing', () => {
        const result = auth_validators_1.registerSchema.safeParse(validBase);
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('rejects registration when acceptLegal is false', () => {
        const result = auth_validators_1.registerSchema.safeParse({ ...validBase, acceptLegal: false });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('accepts organizationName with optional first and last name', () => {
        const result = auth_validators_1.registerSchema.safeParse({
            organizationName: 'Acme Corp',
            firstName: 'Pat',
            lastName: 'Lee',
            email: 'owner@acme.com',
            password: 'SecurePass1',
            acceptLegal: true,
        });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
});
//# sourceMappingURL=auth.validators.spec.js.map