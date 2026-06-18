"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const api_errors_1 = require("./api-errors");
(0, vitest_1.describe)('api-errors', () => {
    (0, vitest_1.it)('extracts requestId from error body', () => {
        (0, vitest_1.expect)((0, api_errors_1.getApiRequestId)({ requestId: 'abc-123-def' })).toBe('abc-123-def');
        (0, vitest_1.expect)((0, api_errors_1.getApiRequestId)({})).toBeUndefined();
    });
    (0, vitest_1.it)('formats 5xx with reference', () => {
        const msg = (0, api_errors_1.formatUserFacingApiError)({
            status: 500,
            message: 'Database error',
            requestId: 'req-abcdef12-3456',
        });
        (0, vitest_1.expect)(msg).toContain('Database error');
        (0, vitest_1.expect)(msg).toContain('Reference: req-abcd');
    });
    (0, vitest_1.it)('formats 404 with hint only for generic not found', () => {
        const generic = (0, api_errors_1.formatUserFacingApiError)({
            status: 404,
            message: '',
            code: 'NOT_FOUND',
        });
        (0, vitest_1.expect)(generic).toContain('That resource was not found.');
        (0, vitest_1.expect)(generic).toContain('app and API versions');
        const specific = (0, api_errors_1.formatUserFacingApiError)({
            status: 404,
            message: 'Queue not found',
            code: 'NOT_FOUND',
        });
        (0, vitest_1.expect)(specific).toBe('Queue not found');
    });
});
//# sourceMappingURL=api-errors.spec.js.map