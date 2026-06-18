"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_TERMINAL_STATUSES = exports.TICKET_ERROR_CODES = void 0;
exports.isTicketTerminalStatus = isTicketTerminalStatus;
/** Stable API error codes for ticket lifecycle / workbench actions. */
exports.TICKET_ERROR_CODES = {
    INVALID_TRANSITION: 'TICKET_INVALID_TRANSITION',
    ALREADY_TERMINAL: 'TICKET_ALREADY_TERMINAL',
};
exports.TICKET_TERMINAL_STATUSES = ['completed', 'no_show', 'cancelled'];
function isTicketTerminalStatus(status) {
    return exports.TICKET_TERMINAL_STATUSES.includes(status);
}
//# sourceMappingURL=ticket-errors.js.map