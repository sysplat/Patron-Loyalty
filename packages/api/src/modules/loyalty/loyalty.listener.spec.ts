import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LOYALTY_CAMPAIGN_TRIGGERS,
  LOYALTY_EVENTS,
  LOYALTY_WEBHOOK_EVENTS,
} from '@queueplatform/shared';
import { LoyaltyListener } from './loyalty.listener';
import {
  LoyaltyAppointmentCompletedEvent,
  LoyaltyAppointmentNoShowEvent,
  LoyaltyCustomerCreatedEvent,
  LoyaltyReviewSubmittedEvent,
  LoyaltyTicketCompletedEvent,
  LoyaltyTicketNoShowEvent,
} from './loyalty.events';

describe('LoyaltyListener', () => {
  const queueEvents = {
    onTicketCompleted: vi.fn().mockResolvedValue({ ok: true }),
    onAppointmentCompleted: vi.fn().mockResolvedValue({ ok: true }),
    onReviewSubmitted: vi.fn().mockResolvedValue({ ok: true }),
    onCustomerCreated: vi.fn().mockResolvedValue({ ok: true }),
    onTicketNoShow: vi.fn().mockResolvedValue({ ok: true }),
    onAppointmentNoShow: vi.fn().mockResolvedValue({ ok: true }),
  };
  const prisma = {
    withTenant: vi.fn(),
  };
  const campaignAutomation = { fireTrigger: vi.fn().mockResolvedValue(undefined) };
  const loyaltyWebhook = { dispatch: vi.fn() };

  let listener: LoyaltyListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({ customerId: 'cust-1' }),
        },
      }),
    );

    listener = new LoyaltyListener(
      queueEvents as never,
      prisma as never,
      campaignAutomation as never,
      loyaltyWebhook as never,
    );
  });

  it('delegates ticket completed to queue events', async () => {
    await listener.onTicketCompleted(
      new LoyaltyTicketCompletedEvent('org-1', 'ticket-1', 'cust-1', 'branch-1', 'svc-1'),
    );
    expect(queueEvents.onTicketCompleted).toHaveBeenCalled();
  });

  it('delegates appointment, review, customer, and no-show handlers', async () => {
    await listener.onAppointmentCompleted(
      new LoyaltyAppointmentCompletedEvent('org-1', 'appt-1', 'cust-1', 'branch-1'),
    );
    await listener.onReviewSubmitted(
      new LoyaltyReviewSubmittedEvent('org-1', 'review-1', 'cust-1', 5),
    );
    await listener.onCustomerCreated(new LoyaltyCustomerCreatedEvent('org-1', 'cust-1'));
    await listener.onTicketNoShow(
      new LoyaltyTicketNoShowEvent('org-1', 'ticket-2', 'cust-1', 'branch-1'),
    );
    await listener.onAppointmentNoShow(
      new LoyaltyAppointmentNoShowEvent('org-1', 'appt-2', 'cust-1', 'branch-1'),
    );

    expect(queueEvents.onAppointmentCompleted).toHaveBeenCalled();
    expect(queueEvents.onReviewSubmitted).toHaveBeenCalled();
    expect(queueEvents.onCustomerCreated).toHaveBeenCalled();
    expect(queueEvents.onTicketNoShow).toHaveBeenCalled();
    expect(queueEvents.onAppointmentNoShow).toHaveBeenCalled();
  });

  it('fires tier upgrade campaign and webhook', async () => {
    await listener.onTierUpgraded('org-1', 'acc-1', 'gold');

    expect(campaignAutomation.fireTrigger).toHaveBeenCalledWith(
      'org-1',
      LOYALTY_CAMPAIGN_TRIGGERS.TIER_UPGRADE,
      'cust-1',
    );
    expect(loyaltyWebhook.dispatch).toHaveBeenCalledWith(
      'org-1',
      LOYALTY_WEBHOOK_EVENTS.TIER_UPGRADED,
      expect.objectContaining({ accountId: 'acc-1', tierSlug: 'gold' }),
    );
  });

  it('registers ticket completed event name', () => {
    expect(LOYALTY_EVENTS.TICKET_COMPLETED).toBe('loyalty.ticket.completed');
  });
});
