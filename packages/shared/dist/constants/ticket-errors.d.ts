/** Stable API error codes for ticket lifecycle / workbench actions. */
export declare const TICKET_ERROR_CODES: {
    readonly INVALID_TRANSITION: "TICKET_INVALID_TRANSITION";
    readonly ALREADY_TERMINAL: "TICKET_ALREADY_TERMINAL";
};
export type TicketErrorCode = (typeof TICKET_ERROR_CODES)[keyof typeof TICKET_ERROR_CODES];
export declare const TICKET_TERMINAL_STATUSES: readonly ["completed", "no_show", "cancelled"];
export type TicketTerminalStatus = (typeof TICKET_TERMINAL_STATUSES)[number];
export declare function isTicketTerminalStatus(status: string): status is TicketTerminalStatus;
//# sourceMappingURL=ticket-errors.d.ts.map