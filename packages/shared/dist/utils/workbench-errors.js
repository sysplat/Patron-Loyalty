"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBenignWorkbenchActionErrorPayload = isBenignWorkbenchActionErrorPayload;
const ticket_errors_1 = require("../constants/ticket-errors");
/**
 * Whether a workbench API error is a harmless duplicate click (refresh UI, no user toast).
 * Used by the journey workbench and unit tests; pass code/details from ApiError or raw JSON.
 */
function isBenignWorkbenchActionErrorPayload(code, details) {
    if (code === ticket_errors_1.TICKET_ERROR_CODES.ALREADY_TERMINAL)
        return true;
    if (code === ticket_errors_1.TICKET_ERROR_CODES.INVALID_TRANSITION) {
        const currentStatus = typeof details?.currentStatus === 'string' ? details.currentStatus : undefined;
        if (currentStatus && (0, ticket_errors_1.isTicketTerminalStatus)(currentStatus))
            return true;
        const allowed = details?.allowedStatuses;
        if (currentStatus === 'serving' && Array.isArray(allowed) && allowed.includes('called')) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=workbench-errors.js.map