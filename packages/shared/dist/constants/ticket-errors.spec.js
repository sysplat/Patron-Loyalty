"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ticket_errors_1 = require("./ticket-errors");
(0, vitest_1.describe)('TICKET_ERROR_CODES', () => {
    (0, vitest_1.it)('exposes stable string codes for API clients', () => {
        (0, vitest_1.expect)(ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION).toBe('TICKET_INVALID_TRANSITION');
        (0, vitest_1.expect)(ticket_errors_1.TICKET_ERROR_CODES.ALREADY_TERMINAL).toBe('TICKET_ALREADY_TERMINAL');
    });
});
(0, vitest_1.describe)('isTicketTerminalStatus', () => {
    (0, vitest_1.it)('returns true for terminal lifecycle statuses', () => {
        for (const status of ticket_errors_1.TICKET_TERMINAL_STATUSES) {
            (0, vitest_1.expect)((0, ticket_errors_1.isTicketTerminalStatus)(status)).toBe(true);
        }
    });
    (0, vitest_1.it)('returns false for active desk statuses', () => {
        (0, vitest_1.expect)((0, ticket_errors_1.isTicketTerminalStatus)('waiting')).toBe(false);
        (0, vitest_1.expect)((0, ticket_errors_1.isTicketTerminalStatus)('called')).toBe(false);
        (0, vitest_1.expect)((0, ticket_errors_1.isTicketTerminalStatus)('serving')).toBe(false);
    });
    (0, vitest_1.it)('returns false for unknown strings', () => {
        (0, vitest_1.expect)((0, ticket_errors_1.isTicketTerminalStatus)('active')).toBe(false);
    });
});
//# sourceMappingURL=ticket-errors.spec.js.map