import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import {
  LOYALTY_EARN_EVENT_TYPES,
  LOYALTY_POINT_LEDGER_TYPES,
  LOYALTY_WEBHOOK_EVENTS,
} from '@queueplatform/shared';
import { LoyaltyAccountEarnService } from './loyalty-account-earn.service';

const ORG_ID = 'org-1';
const CUSTOMER_ID = 'cust-1';

describe('LoyaltyAccountEarnService', () => {
  const patronCrmFeature = {
    isEnabled: vi.fn(),
    requireEnabled: vi.fn().mockResolvedValue(undefined),
  };
  const programService = { resolveEarnPoints: vi.fn() };
  const lifecycle = { ensureAccount: vi.fn() };
  const points = {
    applyPoints: vi.fn(),
    adjustPointsInTransaction: vi.fn(),
  };
  const loyaltyWebhook = { dispatch: vi.fn() };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyAccountEarnService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyAccountEarnService(
      prisma as never,
      patronCrmFeature as never,
      programService as never,
      loyaltyWebhook as never,
      lifecycle as never,
      points as never,
    );
  });

  it('returns null when customerId missing', async () => {
    expect(
      await service.earnFromEvent(ORG_ID, null, LOYALTY_EARN_EVENT_TYPES.VISIT, {
        sourceType: 'ticket',
        sourceId: 't-1',
      }),
    ).toBeNull();
  });

  it('returns null when loyalty disabled', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(false);
    expect(
      await service.earnFromEvent(ORG_ID, CUSTOMER_ID, LOYALTY_EARN_EVENT_TYPES.VISIT, {
        sourceType: 'ticket',
        sourceId: 't-1',
      }),
    ).toBeNull();
  });

  it('applies points when earn resolves positive', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    lifecycle.ensureAccount.mockResolvedValue({ id: 'acct-1', tier: { slug: 'bronze' } });
    programService.resolveEarnPoints.mockResolvedValue(10);
    points.applyPoints.mockResolvedValue({
      pointsBalance: 110,
      idempotent: false,
      account: { id: 'acct-1' },
    });

    const result = await service.earnFromEvent(
      ORG_ID,
      CUSTOMER_ID,
      LOYALTY_EARN_EVENT_TYPES.VISIT,
      { sourceType: 'ticket', sourceId: 't-1' },
    );

    expect(points.applyPoints).toHaveBeenCalled();
    expect(result).toMatchObject({ pointsBalance: 110 });
  });

  it('earnIntegrationPoints applies integration ledger type', async () => {
    points.applyPoints.mockResolvedValue({ account: { id: 'acct-1', pointsBalance: 60 } });

    const account = await service.earnIntegrationPoints(ORG_ID, 'acct-1', 10, {
      sourceId: 'txn-1',
      description: 'POS earn',
    });

    expect(points.applyPoints).toHaveBeenCalledWith(
      ORG_ID,
      'acct-1',
      10,
      LOYALTY_POINT_LEDGER_TYPES.EARN,
      expect.objectContaining({ sourceType: 'integration', sourceId: 'txn-1' }),
    );
    expect(account).toMatchObject({ pointsBalance: 60 });
  });

  it('expires inactive account points', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    const staleDate = new Date(Date.now() - 400 * 86_400_000);
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyAccount: {
            findMany: vi.fn().mockResolvedValue([{ id: 'acct-1', pointsBalance: 50 }]),
          },
        });
      }
      return fn({
        loyaltyPointLedger: {
          findFirst: vi.fn().mockResolvedValue({ createdAt: staleDate }),
        },
      });
    });
    points.applyPoints.mockResolvedValue({});

    const expired = await service.expireInactivePoints(ORG_ID, 365);
    expect(expired).toBe(1);
    expect(points.applyPoints).toHaveBeenCalledWith(
      ORG_ID,
      'acct-1',
      50,
      LOYALTY_POINT_LEDGER_TYPES.EXPIRE,
      expect.objectContaining({ sourceType: 'expiry' }),
    );
  });

  it('handleNoShow lowers health score and dispatches webhook', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    lifecycle.ensureAccount.mockResolvedValue({
      id: 'acct-1',
      healthScore: 70,
      customerId: CUSTOMER_ID,
    });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: { update: vi.fn().mockResolvedValue({}) },
      }),
    );

    await service.handleNoShow(ORG_ID, CUSTOMER_ID, {
      sourceType: 'appointment',
      sourceId: 'appt-1',
    });

    expect(loyaltyWebhook.dispatch).toHaveBeenCalledWith(
      ORG_ID,
      LOYALTY_WEBHOOK_EVENTS.VISIT_NO_SHOW,
      expect.objectContaining({ customerId: CUSTOMER_ID }),
    );
  });

  it('handleTicketCompleted delegates to earnFromEvent', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    lifecycle.ensureAccount.mockResolvedValue({ id: 'acct-1', tier: null });
    programService.resolveEarnPoints.mockResolvedValue(5);
    points.applyPoints.mockResolvedValue({ pointsBalance: 105 });

    await service.handleTicketCompleted(ORG_ID, 'ticket-1', CUSTOMER_ID, 'branch-1');

    expect(programService.resolveEarnPoints).toHaveBeenCalledWith(
      ORG_ID,
      LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
      expect.objectContaining({ branchId: 'branch-1' }),
    );
  });

  it('adjustPoints throws when account missing', async () => {
    lifecycle.ensureAccount.mockResolvedValue(null);
    await expect(service.adjustPoints(ORG_ID, CUSTOMER_ID, 10)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('adjustPoints applies manual credit', async () => {
    lifecycle.ensureAccount.mockResolvedValue({ id: 'acct-1' });
    points.applyPoints.mockResolvedValue({ account: { id: 'acct-1', pointsBalance: 110 } });

    const account = await service.adjustPoints(ORG_ID, CUSTOMER_ID, 10, 'Bonus');
    expect(points.applyPoints).toHaveBeenCalledWith(
      ORG_ID,
      'acct-1',
      10,
      LOYALTY_POINT_LEDGER_TYPES.ADJUST,
      expect.objectContaining({ sourceType: 'manual', description: 'Bonus' }),
    );
    expect(account).toMatchObject({ pointsBalance: 110 });
  });
});
