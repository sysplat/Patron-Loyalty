import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_EARN_EVENT_TYPES } from '@queueplatform/shared';
import { LoyaltyAccountEarnService } from './loyalty-account-earn.service';

const ORG_ID = 'org-1';
const CUSTOMER_ID = 'cust-1';

describe('LoyaltyAccountEarnService', () => {
  const patronCrmFeature = { isEnabled: vi.fn() };
  const programService = { resolveEarnPoints: vi.fn() };
  const lifecycle = { ensureAccount: vi.fn() };
  const points = { applyPoints: vi.fn() };
  const loyaltyWebhook = { emit: vi.fn() };
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
    points.applyPoints.mockResolvedValue({ pointsBalance: 110, idempotent: false });

    const result = await service.earnFromEvent(
      ORG_ID,
      CUSTOMER_ID,
      LOYALTY_EARN_EVENT_TYPES.VISIT,
      { sourceType: 'ticket', sourceId: 't-1' },
    );

    expect(points.applyPoints).toHaveBeenCalled();
    expect(result).toMatchObject({ pointsBalance: 110 });
  });
});
