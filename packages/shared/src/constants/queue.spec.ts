import { describe, expect, it } from 'vitest';
import { canManuallyCallWaitingTicket, queueUsesManualRowCall } from './queue';

describe('queueUsesManualRowCall', () => {
  it('is true only for manual calling policies', () => {
    expect(queueUsesManualRowCall('manual_only')).toBe(true);
    expect(queueUsesManualRowCall('ready_then_manual')).toBe(true);
    expect(queueUsesManualRowCall('fifo')).toBe(false);
    expect(queueUsesManualRowCall('ready_then_fifo')).toBe(false);
  });
});

describe('canManuallyCallWaitingTicket', () => {
  it('allows manual_only without readyAt', () => {
    expect(canManuallyCallWaitingTicket('manual_only', null)).toBe(true);
  });

  it('requires readyAt for ready_then_manual', () => {
    expect(canManuallyCallWaitingTicket('ready_then_manual', null)).toBe(false);
    expect(canManuallyCallWaitingTicket('ready_then_manual', '2026-01-01')).toBe(true);
  });

  it('rejects call-next-only policies', () => {
    expect(canManuallyCallWaitingTicket('fifo', null)).toBe(false);
    expect(canManuallyCallWaitingTicket('ready_then_fifo', '2026-01-01')).toBe(false);
  });
});
