import { describe, it, expect } from 'vitest';
import {
  isTicketTerminalStatus,
  TICKET_ERROR_CODES,
  TICKET_TERMINAL_STATUSES,
} from './ticket-errors';

describe('TICKET_ERROR_CODES', () => {
  it('exposes stable string codes for API clients', () => {
    expect(TICKET_ERROR_CODES.INVALID_TRANSITION).toBe('TICKET_INVALID_TRANSITION');
    expect(TICKET_ERROR_CODES.ALREADY_TERMINAL).toBe('TICKET_ALREADY_TERMINAL');
  });
});

describe('isTicketTerminalStatus', () => {
  it('returns true for terminal lifecycle statuses', () => {
    for (const status of TICKET_TERMINAL_STATUSES) {
      expect(isTicketTerminalStatus(status)).toBe(true);
    }
  });

  it('returns false for active desk statuses', () => {
    expect(isTicketTerminalStatus('waiting')).toBe(false);
    expect(isTicketTerminalStatus('called')).toBe(false);
    expect(isTicketTerminalStatus('serving')).toBe(false);
  });

  it('returns false for unknown strings', () => {
    expect(isTicketTerminalStatus('active')).toBe(false);
  });
});
