import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyCampaignDispatchService } from './loyalty-campaign-dispatch.service';

const ORG_ID = 'org-1';
const CAMPAIGN_ID = 'camp-1';

describe('LoyaltyCampaignDispatchService', () => {
  const notifications = { sendSms: vi.fn(), sendEmail: vi.fn() };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyCampaignDispatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyCampaignDispatchService(prisma as never, notifications as never);
  });

  it('returns zeros when campaign not found', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaign: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    const result = await service.dispatchCampaign(ORG_ID, CAMPAIGN_ID);
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });

  it('skips sendToAccount when campaign inactive', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaign: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    expect(await service.sendToAccount(ORG_ID, CAMPAIGN_ID, 'acct-1')).toBe('skipped');
  });

  it('dispatches queued sends and marks campaign completed', async () => {
    const update = vi.fn().mockResolvedValue({});
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyCampaign: {
            findFirst: vi.fn().mockResolvedValue({
              id: CAMPAIGN_ID,
              channel: 'sms',
              messageBody: 'Hello',
            }),
          },
        });
      }
      if (callCount === 2) {
        return fn({
          loyaltyCampaignSend: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        });
      }
      if (callCount === 3) {
        return fn({
          loyaltyCampaignSend: { count: vi.fn().mockResolvedValue(0) },
        });
      }
      return fn({ loyaltyCampaign: { update } });
    });

    const result = await service.dispatchCampaign(ORG_ID, CAMPAIGN_ID);
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(update).toHaveBeenCalled();
  });
});
