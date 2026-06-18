import { describe, it, expect } from 'vitest';
import { isBenignWorkbenchActionErrorPayload } from './workbench-errors';
import { TICKET_ERROR_CODES } from '../constants/ticket-errors';

describe('isBenignWorkbenchActionErrorPayload', () => {
  it('treats TICKET_ALREADY_TERMINAL as benign', () => {
    expect(isBenignWorkbenchActionErrorPayload(TICKET_ERROR_CODES.ALREADY_TERMINAL, {})).toBe(true);
  });

  it('treats INVALID_TRANSITION on completed ticket as benign (double complete)', () => {
    expect(
      isBenignWorkbenchActionErrorPayload(TICKET_ERROR_CODES.INVALID_TRANSITION, {
        currentStatus: 'completed',
        allowedStatuses: ['called', 'serving'],
        targetStatus: 'completed',
      }),
    ).toBe(true);
  });

  it('treats INVALID_TRANSITION on no_show as benign', () => {
    expect(
      isBenignWorkbenchActionErrorPayload(TICKET_ERROR_CODES.INVALID_TRANSITION, {
        currentStatus: 'no_show',
        allowedStatuses: ['called', 'serving'],
      }),
    ).toBe(true);
  });

  it('treats duplicate serve while already serving as benign', () => {
    expect(
      isBenignWorkbenchActionErrorPayload(TICKET_ERROR_CODES.INVALID_TRANSITION, {
        currentStatus: 'serving',
        allowedStatuses: ['called'],
        targetStatus: 'serving',
      }),
    ).toBe(true);
  });

  it('does not treat INVALID_TRANSITION on waiting as benign', () => {
    expect(
      isBenignWorkbenchActionErrorPayload(TICKET_ERROR_CODES.INVALID_TRANSITION, {
        currentStatus: 'waiting',
        allowedStatuses: ['called', 'serving'],
        targetStatus: 'completed',
      }),
    ).toBe(false);
  });

  it('does not treat unrelated codes as benign', () => {
    expect(isBenignWorkbenchActionErrorPayload('VISIT_TICKET_REQUIRES_WORKBENCH', {})).toBe(false);
  });

  it('does not treat missing code as benign', () => {
    expect(isBenignWorkbenchActionErrorPayload(undefined, {})).toBe(false);
  });
});
