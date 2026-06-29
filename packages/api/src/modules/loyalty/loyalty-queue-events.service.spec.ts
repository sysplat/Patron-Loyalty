import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LOYALTY_CAMPAIGN_TRIGGERS,
  LOYALTY_WEBHOOK_EVENTS,
  QLESSQ_QUEUE_INTEGRATION_EVENTS,
} from '@queueplatform/shared';
import { LoyaltyTicketCompletedEvent } from './loyalty.events';
import { LoyaltyQueueEventsService } from './loyalty-queue-events.service';

const ORG_ID = 'org-1';
const CUSTOMER_ID = 'cust-1';
const BRANCH_ID = 'branch-1';

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
  const customerFindFirst = vi.fn();
  const prisma = {
    withTenant: vi.fn((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ customer: { findFirst: customerFindFirst } }),
    ),
  };
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
    integration.upsertCustomer.mockResolvedValue({ customerId: CUSTOMER_ID });
    customerFindFirst.mockResolvedValue(null);

    service = new LoyaltyQueueEventsService(
      accounts as never,
      gamification as never,
      prisma as never,
      campaignAutomation as never,
      loyaltyWebhook as never,
      integration as never,
    );
  });

  describe(QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED, () => {
    it('resolves customer by externalId and awards visit credit', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
        sourceId: 'ticket-1',
        branchId: BRANCH_ID,
        customer: { externalId: 'qlessq-cust-1', name: 'Jane' },
      });

      expect(integration.upsertCustomer).toHaveBeenCalledWith(ORG_ID, {
        externalId: 'qlessq-cust-1',
        name: 'Jane',
        email: undefined,
        phone: undefined,
      });
      expect(accounts.handleTicketCompleted).toHaveBeenCalledWith(
        ORG_ID,
        'ticket-1',
        CUSTOMER_ID,
        BRANCH_ID,
      );
      expect(gamification.incrementChallengeProgress).toHaveBeenCalledWith(
        ORG_ID,
        CUSTOMER_ID,
        'VISITS',
      );
      expect(gamification.evaluateBadgesForAccount).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID);
      expect(result).toMatchObject({
        ok: true,
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
        sourceId: 'ticket-1',
      });
    });

    it('returns idempotent without gamification side effects', async () => {
      accounts.handleTicketCompleted.mockResolvedValue({ idempotent: true });

      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
        sourceId: 'ticket-1',
        customerId: CUSTOMER_ID,
        branchId: BRANCH_ID,
      });

      expect(result).toMatchObject({ ok: true, idempotent: true, sourceId: 'ticket-1' });
      expect(gamification.incrementChallengeProgress).not.toHaveBeenCalled();
      expect(gamification.evaluateBadgesForAccount).not.toHaveBeenCalled();
    });

    it('skips earn when customer cannot be resolved', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
        sourceId: 'ticket-2',
        branchId: BRANCH_ID,
      });

      expect(result).toMatchObject({ skipped: true, reason: 'no_customer', sourceId: 'ticket-2' });
      expect(accounts.handleTicketCompleted).not.toHaveBeenCalled();
    });
  });

  describe(QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_NO_SHOW, () => {
    it('fires win-back when customer is known', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_NO_SHOW,
        sourceId: 'ticket-3',
        customerId: CUSTOMER_ID,
        branchId: BRANCH_ID,
      });

      expect(accounts.handleNoShow).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID, {
        sourceType: 'ticket',
        sourceId: 'ticket-3',
      });
      expect(campaignAutomation.fireTrigger).toHaveBeenCalledWith(
        ORG_ID,
        LOYALTY_CAMPAIGN_TRIGGERS.WIN_BACK,
        CUSTOMER_ID,
      );
      expect(result).toMatchObject({
        ok: true,
        sourceId: 'ticket-3',
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_NO_SHOW,
      });
    });

    it('still records no-show when customer id is missing', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_NO_SHOW,
        sourceId: 'ticket-4',
        branchId: BRANCH_ID,
      });

      expect(accounts.handleNoShow).toHaveBeenCalledWith(ORG_ID, null, {
        sourceType: 'ticket',
        sourceId: 'ticket-4',
      });
      expect(campaignAutomation.fireTrigger).not.toHaveBeenCalled();
      expect(result).toMatchObject({ ok: true, sourceId: 'ticket-4' });
    });
  });

  describe(QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_COMPLETED, () => {
    it('resolves customer by phone and awards visit credit', async () => {
      customerFindFirst.mockResolvedValue({ id: CUSTOMER_ID });

      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_COMPLETED,
        sourceId: 'appt-1',
        branchId: BRANCH_ID,
        customerPhone: '+15551234567',
      });

      expect(accounts.handleAppointmentCompleted).toHaveBeenCalledWith(
        ORG_ID,
        'appt-1',
        CUSTOMER_ID,
        BRANCH_ID,
      );
      expect(gamification.incrementChallengeProgress).toHaveBeenCalledWith(
        ORG_ID,
        CUSTOMER_ID,
        'VISITS',
      );
      expect(result).toMatchObject({
        ok: true,
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_COMPLETED,
        sourceId: 'appt-1',
      });
    });

    it('returns idempotent without challenge progress', async () => {
      accounts.handleAppointmentCompleted.mockResolvedValue({ idempotent: true });

      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_COMPLETED,
        sourceId: 'appt-2',
        customerId: CUSTOMER_ID,
        branchId: BRANCH_ID,
      });

      expect(result).toMatchObject({ ok: true, idempotent: true, sourceId: 'appt-2' });
      expect(gamification.incrementChallengeProgress).not.toHaveBeenCalled();
    });

    it('skips when customer cannot be resolved', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_COMPLETED,
        sourceId: 'appt-3',
        branchId: BRANCH_ID,
      });

      expect(result).toMatchObject({ skipped: true, reason: 'no_customer', sourceId: 'appt-3' });
      expect(accounts.handleAppointmentCompleted).not.toHaveBeenCalled();
    });
  });

  describe(QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_NO_SHOW, () => {
    it('fires win-back after resolving customer by email', async () => {
      customerFindFirst.mockResolvedValue({ id: CUSTOMER_ID });

      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_NO_SHOW,
        sourceId: 'appt-4',
        branchId: BRANCH_ID,
        customerEmail: 'patron@example.com',
      });

      expect(accounts.handleNoShow).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID, {
        sourceType: 'appointment',
        sourceId: 'appt-4',
      });
      expect(campaignAutomation.fireTrigger).toHaveBeenCalledWith(
        ORG_ID,
        LOYALTY_CAMPAIGN_TRIGGERS.WIN_BACK,
        CUSTOMER_ID,
      );
      expect(result).toMatchObject({
        ok: true,
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.APPOINTMENT_NO_SHOW,
        sourceId: 'appt-4',
      });
    });
  });

  describe(QLESSQ_QUEUE_INTEGRATION_EVENTS.REVIEW_SUBMITTED, () => {
    it('awards review points when customer is known', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.REVIEW_SUBMITTED,
        sourceId: 'review-1',
        customerId: CUSTOMER_ID,
        rating: 5,
      });

      expect(accounts.handleReviewSubmitted).toHaveBeenCalledWith(ORG_ID, 'review-1', CUSTOMER_ID);
      expect(result).toMatchObject({
        ok: true,
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.REVIEW_SUBMITTED,
        sourceId: 'review-1',
      });
    });

    it('returns idempotent on replay', async () => {
      accounts.handleReviewSubmitted.mockResolvedValue({ idempotent: true });

      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.REVIEW_SUBMITTED,
        sourceId: 'review-2',
        customerId: CUSTOMER_ID,
        rating: 4,
      });

      expect(result).toMatchObject({ ok: true, idempotent: true, sourceId: 'review-2' });
    });

    it('skips when customer is missing', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.REVIEW_SUBMITTED,
        sourceId: 'review-3',
        rating: 3,
      });

      expect(result).toMatchObject({ skipped: true, reason: 'no_customer', sourceId: 'review-3' });
      expect(accounts.handleReviewSubmitted).not.toHaveBeenCalled();
    });
  });

  describe(QLESSQ_QUEUE_INTEGRATION_EVENTS.CUSTOMER_CREATED, () => {
    it('ensures account and fires welcome automation', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.CUSTOMER_CREATED,
        sourceId: 'cust-new',
        customer: { externalId: 'qlessq-new', name: 'New Patron' },
      });

      expect(accounts.ensureAccount).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID);
      expect(campaignAutomation.fireTrigger).toHaveBeenCalledWith(
        ORG_ID,
        LOYALTY_CAMPAIGN_TRIGGERS.WELCOME,
        CUSTOMER_ID,
      );
      expect(loyaltyWebhook.dispatch).toHaveBeenCalledWith(
        ORG_ID,
        LOYALTY_WEBHOOK_EVENTS.CUSTOMER_CREATED,
        { customerId: CUSTOMER_ID },
      );
      expect(result).toMatchObject({
        ok: true,
        sourceId: 'cust-new',
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.CUSTOMER_CREATED,
      });
    });

    it('skips when customer cannot be resolved', async () => {
      const result = await service.processRemoteEvent(ORG_ID, {
        event: QLESSQ_QUEUE_INTEGRATION_EVENTS.CUSTOMER_CREATED,
        sourceId: 'cust-orphan',
      });

      expect(integration.upsertCustomer).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        skipped: true,
        reason: 'no_customer',
        sourceId: 'cust-orphan',
      });
      expect(accounts.ensureAccount).not.toHaveBeenCalled();
    });
  });

  it('resolves customer by customerId without upsert', async () => {
    const result = await service.processRemoteEvent(ORG_ID, {
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
      sourceId: 'ticket-direct',
      customerId: CUSTOMER_ID,
      branchId: BRANCH_ID,
    });

    expect(integration.upsertCustomer).not.toHaveBeenCalled();
    expect(accounts.handleTicketCompleted).toHaveBeenCalledWith(
      ORG_ID,
      'ticket-direct',
      CUSTOMER_ID,
      BRANCH_ID,
    );
    expect(result).toMatchObject({ ok: true, sourceId: 'ticket-direct' });
  });

  it('resolves customer by email on queue payload', async () => {
    customerFindFirst.mockResolvedValue({ id: CUSTOMER_ID });

    const result = await service.processRemoteEvent(ORG_ID, {
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
      sourceId: 'ticket-email',
      branchId: BRANCH_ID,
      customerEmail: 'patron@example.com',
    });

    expect(accounts.handleTicketCompleted).toHaveBeenCalledWith(
      ORG_ID,
      'ticket-email',
      CUSTOMER_ID,
      BRANCH_ID,
    );
    expect(result).toMatchObject({ ok: true, sourceId: 'ticket-email' });
  });

  it('does not run gamification when ticket handler returns no earn row', async () => {
    accounts.handleTicketCompleted.mockResolvedValue(null);

    const result = await service.onTicketCompleted(
      new LoyaltyTicketCompletedEvent(ORG_ID, 'ticket-empty', CUSTOMER_ID, BRANCH_ID, null),
    );

    expect(result).toEqual({ ok: true });
    expect(gamification.incrementChallengeProgress).not.toHaveBeenCalled();
  });

  it('rethrows when ticket handler fails', async () => {
    accounts.handleTicketCompleted.mockRejectedValue(new Error('db down'));
    await expect(
      service.onTicketCompleted(
        new LoyaltyTicketCompletedEvent(ORG_ID, 'ticket-err', CUSTOMER_ID, BRANCH_ID, null),
      ),
    ).rejects.toThrow('db down');
  });
});
