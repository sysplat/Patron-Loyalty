/** Stable API error codes for ticket lifecycle / workbench actions. */
export const TICKET_ERROR_CODES = {
  INVALID_TRANSITION: 'TICKET_INVALID_TRANSITION',
  ALREADY_TERMINAL: 'TICKET_ALREADY_TERMINAL',
} as const;

export type TicketErrorCode = (typeof TICKET_ERROR_CODES)[keyof typeof TICKET_ERROR_CODES];

export const TICKET_TERMINAL_STATUSES = ['completed', 'no_show', 'cancelled'] as const;

export type TicketTerminalStatus = (typeof TICKET_TERMINAL_STATUSES)[number];

export function isTicketTerminalStatus(status: string): status is TicketTerminalStatus {
  return (TICKET_TERMINAL_STATUSES as readonly string[]).includes(status);
}
