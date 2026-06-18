import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_EVENTS } from '@queueplatform/shared';
import { LoyaltyListener } from './loyalty.listener';
import { LoyaltyTicketCompletedEvent } from './loyalty.events';

describe('LoyaltyListener', () => {
  const queueEvents = {
    onTicketCompleted: vi.fn().mockResolvedValue({ ok: true }),
  };

  let listener: LoyaltyListener;

  beforeEach(() => {
    vi.clearAllMocks();
    listener = new LoyaltyListener(
      queueEvents as never,
      {} as never,
      { fireTrigger: vi.fn() } as never,
      { dispatch: vi.fn() } as never,
    );
  });

  it('delegates ticket completed to queue events', async () => {
    await listener.onTicketCompleted(
      new LoyaltyTicketCompletedEvent('org-1', 'ticket-1', 'cust-1', 'branch-1', 'svc-1'),
    );
    expect(queueEvents.onTicketCompleted).toHaveBeenCalled();
  });

  it('registers ticket completed event name', () => {
    expect(LOYALTY_EVENTS.TICKET_COMPLETED).toBe('loyalty.ticket.completed');
  });
});
