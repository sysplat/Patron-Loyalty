"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const workbench_errors_1 = require("./workbench-errors");
const ticket_errors_1 = require("../constants/ticket-errors");
(0, vitest_1.describe)('isBenignWorkbenchActionErrorPayload', () => {
    (0, vitest_1.it)('treats TICKET_ALREADY_TERMINAL as benign', () => {
        (0, vitest_1.expect)((0, workbench_errors_1.isBenignWorkbenchActionErrorPayload)(ticket_errors_1.TICKET_ERROR_CODES.ALREADY_TERMINAL, {})).toBe(true);
    });
    (0, vitest_1.it)('treats INVALID_TRANSITION on completed ticket as benign (double complete)', () => {
        (0, vitest_1.expect)((0, workbench_errors_1.isBenignWorkbenchActionErrorPayload)(ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION, {
            currentStatus: 'completed',
            allowedStatuses: ['called', 'serving'],
            targetStatus: 'completed',
        })).toBe(true);
    });
    (0, vitest_1.it)('treats INVALID_TRANSITION on no_show as benign', () => {
        (0, vitest_1.expect)((0, workbench_errors_1.isBenignWorkbenchActionErrorPayload)(ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION, {
            currentStatus: 'no_show',
            allowedStatuses: ['called', 'serving'],
        })).toBe(true);
    });
    (0, vitest_1.it)('treats duplicate serve while already serving as benign', () => {
        (0, vitest_1.expect)((0, workbench_errors_1.isBenignWorkbenchActionErrorPayload)(ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION, {
            currentStatus: 'serving',
            allowedStatuses: ['called'],
            targetStatus: 'serving',
        })).toBe(true);
    });
    (0, vitest_1.it)('does not treat INVALID_TRANSITION on waiting as benign', () => {
        (0, vitest_1.expect)((0, workbench_errors_1.isBenignWorkbenchActionErrorPayload)(ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION, {
            currentStatus: 'waiting',
            allowedStatuses: ['called', 'serving'],
            targetStatus: 'completed',
        })).toBe(false);
    });
    (0, vitest_1.it)('does not treat unrelated codes as benign', () => {
        (0, vitest_1.expect)((0, workbench_errors_1.isBenignWorkbenchActionErrorPayload)('VISIT_TICKET_REQUIRES_WORKBENCH', {})).toBe(false);
    });
    (0, vitest_1.it)('does not treat missing code as benign', () => {
        (0, vitest_1.expect)((0, workbench_errors_1.isBenignWorkbenchActionErrorPayload)(undefined, {})).toBe(false);
    });
});
//# sourceMappingURL=workbench-errors.spec.js.map