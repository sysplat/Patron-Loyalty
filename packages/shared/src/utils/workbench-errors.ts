import { isTicketTerminalStatus, TICKET_ERROR_CODES } from '../constants/ticket-errors';

/**
 * Whether a workbench API error is a harmless duplicate click (refresh UI, no user toast).
 * Used by the journey workbench and unit tests; pass code/details from ApiError or raw JSON.
 */
export function isBenignWorkbenchActionErrorPayload(
  code: string | undefined,
  details: Record<string, unknown> | undefined,
): boolean {
  if (code === TICKET_ERROR_CODES.ALREADY_TERMINAL) return true;

  if (code === TICKET_ERROR_CODES.INVALID_TRANSITION) {
    const currentStatus =
      typeof details?.currentStatus === 'string' ? details.currentStatus : undefined;
    if (currentStatus && isTicketTerminalStatus(currentStatus)) return true;

    const allowed = details?.allowedStatuses;
    if (currentStatus === 'serving' && Array.isArray(allowed) && allowed.includes('called')) {
      return true;
    }
  }

  return false;
}
