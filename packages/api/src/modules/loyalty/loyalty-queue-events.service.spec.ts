import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QLESSQ_QUEUE_INTEGRATION_EVENTS } from '@queueplatform/shared';
import { LoyaltyQueueEventsService } from './loyalty-queue-events.service';

describe('LoyaltyQueueEventsService processRemoteEvent', () => {
  const accounts = {
    handleTicketCompleted: vi.fn(),
    handleAppointmentCompleted: vi.fn(),
    handleReviewSubmitted: vi.fn(),
    handleNoShow: vi.fn(),
    ensureAccount: vi.fn(),
  };
  const gamification = {
    incrementChallengeProgress: vi.fn(),
    evaluateBadgesForAccount: vi.fn(),
  };
  const prisma = { withTenant: vi.fn() };
  const campaignAutomation = { fireTrigger: vi.fn() };
  const loyaltyWebhook = { dispatch: vi.fn() };
  const integration = {
    upsertCustomer: vi.fn(),
  };

  let service: LoyaltyQueueEventsService;

  beforeEach(() => {
    vi.clearAllMocks();
    accounts.handleTicketCompleted.mockResolvedValue({ idempotent: false });
    accounts.handleAppointmentCompleted.mockResolvedValue({ idempotent: false });
    accounts.handleReviewSubmitted.mockResolvedValue({ idempotent: false });
    accounts.handleNoShow.mockResolvedValue({});
    accounts.ensureAccount.mockResolvedValue({ id: 'acc-1' });
    gamification.incrementChallengeProgress.mockResolvedValue(undefined);
    gamification.evaluateBadgesForAccount.mockResolvedValue([]);
    campaignAutomation.fireTrigger.mockResolvedValue(undefined);
    integration.upsertCustomer.mockResolvedValue({ customerId: 'cust-1' });

    service = new LoyaltyQueueEventsService(
      accounts as never,
      gamification as never,
      prisma as never,
      campaignAutomation as never,
      loyaltyWebhook as never,
      integration as never,
    );
  });

  it('resolves customer by externalId and processes ticket.completed', async () => {
    const result = await service.processRemoteEvent('org-1', {
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
      sourceId: 'ticket-1',
      branchId: 'branch-1',
      customer: { externalId: 'qlessq-cust-1', name: 'Jane' },
    });

    expect(integration.upsertCustomer).toHaveBeenCalledWith('org-1', {
      externalId: 'qlessq-cust-1',
      name: 'Jane',
      email: undefined,
      phone: undefined,
    });
    expect(accounts.handleTicketCompleted).toHaveBeenCalled();
    expect(gamification.incrementChallengeProgress).toHaveBeenCalledWith(
      'org-1',
      'cust-1',
      'VISITS',
    );
    expect(result).toMatchObject({
      ok: true,
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
      sourceId: 'ticket-1',
    });
  });

  it('returns idempotent without gamification side effects', async () => {
    accounts.handleTicketCompleted.mockResolvedValue({ idempotent: true });

    const result = await service.processRemoteEvent('org-1', {
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
      sourceId: 'ticket-1',
      customerId: 'cust-1',
      branchId: 'branch-1',
    });

    expect(result).toMatchObject({ ok: true, idempotent: true, sourceId: 'ticket-1' });
    expect(gamification.incrementChallengeProgress).not.toHaveBeenCalled();
    expect(gamification.evaluateBadgesForAccount).not.toHaveBeenCalled();
  });

  it('skips earn when customer cannot be resolved', async () => {
    const result = await service.processRemoteEvent('org-1', {
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
      sourceId: 'ticket-2',
      branchId: 'branch-1',
    });

    expect(result).toMatchObject({ skipped: true, reason: 'no_customer', sourceId: 'ticket-2' });
    expect(accounts.handleTicketCompleted).not.toHaveBeenCalled();
  });

  it('fires win-back on ticket no-show when customer is known', async () => {
    const result = await service.processRemoteEvent('org-1', {
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_NO_SHOW,
      sourceId: 'ticket-3',
      customerId: 'cust-1',
      branchId: 'branch-1',
    });

    expect(accounts.handleNoShow).toHaveBeenCalled();
    expect(campaignAutomation.fireTrigger).toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, sourceId: 'ticket-3' });
  });

  it('creates loyalty account on customer.created', async () => {
    const result = await service.processRemoteEvent('org-1', {
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.CUSTOMER_CREATED,
      sourceId: 'cust-new',
      customer: { externalId: 'qlessq-new', name: 'New Patron' },
    });

    expect(accounts.ensureAccount).toHaveBeenCalledWith('org-1', 'cust-1');
    expect(campaignAutomation.fireTrigger).toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, sourceId: 'cust-new' });
  });
});
