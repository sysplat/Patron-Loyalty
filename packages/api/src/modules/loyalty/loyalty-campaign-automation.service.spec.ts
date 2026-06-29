import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_CAMPAIGN_TRIGGERS } from '@queueplatform/shared';
import { LoyaltyCampaignAutomationService } from './loyalty-campaign-automation.service';

const ORG_ID = 'org-1';
const CUSTOMER_ID = 'cust-1';

describe('LoyaltyCampaignAutomationService', () => {
  const patronCrmFeature = { isEnabled: vi.fn() };
  const accounts = { ensureAccount: vi.fn() };
  const dispatch = { sendToAccount: vi.fn() };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyCampaignAutomationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyCampaignAutomationService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
      dispatch as never,
    );
  });

  it('returns 0 when loyalty disabled', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(false);
    expect(await service.fireTrigger(ORG_ID, LOYALTY_CAMPAIGN_TRIGGERS.WELCOME, CUSTOMER_ID)).toBe(
      0,
    );
  });

  it('sends active campaigns for trigger', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    accounts.ensureAccount.mockResolvedValue({ id: 'acct-1' });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyCampaign: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ id: 'camp-1', trigger: LOYALTY_CAMPAIGN_TRIGGERS.WELCOME }]),
          },
        });
      }
      return fn({
        loyaltyCampaignSend: { findFirst: vi.fn().mockResolvedValue(null) },
      });
    });
    dispatch.sendToAccount.mockResolvedValue('sent');

    const sent = await service.fireTrigger(ORG_ID, LOYALTY_CAMPAIGN_TRIGGERS.WELCOME, CUSTOMER_ID);
    expect(sent).toBe(1);
    expect(dispatch.sendToAccount).toHaveBeenCalledWith(ORG_ID, 'camp-1', 'acct-1');
  });

  it('returns zeroed daily triggers when disabled', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(false);
    expect(await service.processDailyTriggers(ORG_ID)).toEqual({
      birthday: 0,
      winBack: 0,
      abandoned: 0,
    });
  });
});
