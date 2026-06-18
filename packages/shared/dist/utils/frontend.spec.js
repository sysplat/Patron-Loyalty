"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const frontend_1 = require("./frontend");
const ticket_errors_1 = require("../constants/ticket-errors");
(0, vitest_1.describe)('normalizeApiV1Base', () => {
    (0, vitest_1.it)('appends /api/v1 when host URL omits version prefix', () => {
        (0, vitest_1.expect)((0, frontend_1.normalizeApiV1Base)('https://qms-api-production.up.railway.app')).toBe('https://qms-api-production.up.railway.app/api/v1');
    });
    (0, vitest_1.it)('leaves URLs that already include /api/v1 unchanged', () => {
        (0, vitest_1.expect)((0, frontend_1.normalizeApiV1Base)('http://localhost:4000/api/v1')).toBe('http://localhost:4000/api/v1');
    });
    (0, vitest_1.it)('normalizes relative dev proxy bases', () => {
        (0, vitest_1.expect)((0, frontend_1.normalizeApiV1Base)('/api/v1')).toBe('/api/v1');
    });
});
(0, vitest_1.describe)('getApiBase', () => {
    (0, vitest_1.it)('normalizes NEXT_PUBLIC_API_URL at read time', () => {
        const prev = process.env.NEXT_PUBLIC_API_URL;
        process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
        try {
            (0, vitest_1.expect)((0, frontend_1.getApiBase)()).toBe('https://api.example.com/api/v1');
        }
        finally {
            if (prev === undefined)
                delete process.env.NEXT_PUBLIC_API_URL;
            else
                process.env.NEXT_PUBLIC_API_URL = prev;
        }
    });
});
(0, vitest_1.describe)('getApiErrorCode', () => {
    (0, vitest_1.it)('reads code from GlobalExceptionFilter error envelope', () => {
        const data = {
            success: false,
            error: {
                code: ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION,
                message: 'Ticket is in completed state, expected called or serving',
            },
        };
        (0, vitest_1.expect)((0, frontend_1.getApiErrorCode)(data)).toBe(ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION);
    });
    (0, vitest_1.it)('returns undefined for plain string errors', () => {
        (0, vitest_1.expect)((0, frontend_1.getApiErrorCode)({ message: 'oops' })).toBeUndefined();
    });
    (0, vitest_1.it)('returns undefined for null', () => {
        (0, vitest_1.expect)((0, frontend_1.getApiErrorCode)(null)).toBeUndefined();
    });
});
(0, vitest_1.describe)('getApiErrorDetails', () => {
    (0, vitest_1.it)('reads details from error envelope', () => {
        const data = {
            success: false,
            error: {
                code: ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION,
                message: 'transition failed',
                details: {
                    currentStatus: 'completed',
                    allowedStatuses: ['called', 'serving'],
                    targetStatus: 'completed',
                },
            },
        };
        (0, vitest_1.expect)((0, frontend_1.getApiErrorDetails)(data)).toEqual({
            currentStatus: 'completed',
            allowedStatuses: ['called', 'serving'],
            targetStatus: 'completed',
        });
    });
    (0, vitest_1.it)('returns undefined when details missing', () => {
        (0, vitest_1.expect)((0, frontend_1.getApiErrorDetails)({ error: { code: 'X', message: 'y' } })).toBeUndefined();
    });
});
(0, vitest_1.describe)('extractErrorMessage', () => {
    (0, vitest_1.it)('prefers nested error.message from filter envelope', () => {
        const data = {
            success: false,
            error: {
                code: ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION,
                message: 'Structured ticket message',
            },
        };
        (0, vitest_1.expect)((0, frontend_1.extractErrorMessage)(data, 'Bad Request')).toBe('Structured ticket message');
    });
});
//# sourceMappingURL=frontend.spec.js.map