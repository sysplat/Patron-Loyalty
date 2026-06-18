import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_EVENTS } from '@queueplatform/shared';
import { LoyaltyListener } from './loyalty.listener';
import { LoyaltyTicketCompletedEvent } from './loyalty.events';

describe('LoyaltyListener', () => {
  const accounts = {
    handleTicketCompleted: vi.fn().mockResolvedValue({ pointsBalance: 10 }),
    handleNoShow: vi.fn().mockResolvedValue(null),
  };
  const gamification = {
    incrementChallengeProgress: vi.fn().mockResolvedValue(undefined),
    evaluateBadgesForAccount: vi.fn().mockResolvedValue([]),
  };
  const campaignAutomation = { fireTrigger: vi.fn().mockResolvedValue(0) };
  const loyaltyWebhook = { dispatch: vi.fn().mockResolvedValue(undefined) };

  let listener: LoyaltyListener;

  beforeEach(() => {
    vi.clearAllMocks();
    listener = new LoyaltyListener(
      accounts as never,
      gamification as never,
      {} as never,
      campaignAutomation as never,
      loyaltyWebhook as never,
    );
  });

  it('earns points when a ticket completes for a linked customer', async () => {
    await listener.onTicketCompleted(
      new LoyaltyTicketCompletedEvent('org-1', 'ticket-1', 'cust-1', 'branch-1', 'svc-1'),
    );

    expect(accounts.handleTicketCompleted).toHaveBeenCalledWith(
      'org-1',
      'ticket-1',
      'cust-1',
      'branch-1',
    );
    expect(gamification.incrementChallengeProgress).toHaveBeenCalledWith(
      'org-1',
      'cust-1',
      'VISITS',
    );
    expect(gamification.evaluateBadgesForAccount).toHaveBeenCalledWith('org-1', 'cust-1');
  });

  it('ignores ticket completed events without customerId', async () => {
    await listener.onTicketCompleted(
      new LoyaltyTicketCompletedEvent('org-1', 'ticket-1', null, 'branch-1', null),
    );
    expect(accounts.handleTicketCompleted).not.toHaveBeenCalled();
  });

  it('registers ticket completed event name', () => {
    expect(LOYALTY_EVENTS.TICKET_COMPLETED).toBe('loyalty.ticket.completed');
  });
});
