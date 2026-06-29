import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyCampaignService } from './loyalty-campaign.service';

const ORG_ID = 'org-1';
const CAMPAIGN_ID = 'camp-1';

describe('LoyaltyCampaignService', () => {
  const patronCrmFeature = {
    requireEnabled: vi.fn().mockResolvedValue(undefined),
  };
  const segments = {
    resolvePresetCustomerIds: vi.fn(),
  };
  const dispatch = {
    dispatchCampaign: vi.fn().mockResolvedValue({ sent: 3, failed: 0 }),
  };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyCampaignService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyCampaignService(
      prisma as never,
      patronCrmFeature as never,
      segments as never,
      dispatch as never,
    );
  });

  it('lists campaigns for org', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: CAMPAIGN_ID }]);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyCampaign: { findMany } }),
    );

    const rows = await service.list(ORG_ID);

    expect(rows).toEqual([{ id: CAMPAIGN_ID }]);
    expect(patronCrmFeature.requireEnabled).toHaveBeenCalledWith(ORG_ID);
  });

  it('creates draft campaign when not scheduled in future', async () => {
    const create = vi.fn().mockResolvedValue({ id: CAMPAIGN_ID, status: 'draft' });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyCampaign: { create } }),
    );

    await service.create(ORG_ID, { name: 'Promo', status: 'draft' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgId: ORG_ID, name: 'Promo', status: 'draft' }),
    });
  });

  it('throws when launching missing campaign', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaign: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(service.launch(ORG_ID, CAMPAIGN_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when campaign already completed', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaign: {
          findFirst: vi.fn().mockResolvedValue({ id: CAMPAIGN_ID, status: 'completed' }),
        },
      }),
    );

    await expect(service.launch(ORG_ID, CAMPAIGN_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('queues sends and dispatches active campaign', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({});
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyCampaign: {
            findFirst: vi.fn().mockResolvedValue({
              id: CAMPAIGN_ID,
              orgId: ORG_ID,
              status: 'draft',
              segmentPreset: null,
            }),
          },
        });
      }
      if (callCount === 2) {
        return fn({
          loyaltyAccount: {
            findMany: vi.fn().mockResolvedValue([{ id: 'acct-1' }]),
          },
        });
      }
      if (callCount === 3) {
        return fn({
          loyaltyCampaignSend: { createMany },
          loyaltyCampaign: { update },
        });
      }
      return fn({ loyaltyCampaign: { update } });
    });

    const result = await service.launch(ORG_ID, CAMPAIGN_ID);

    expect(createMany).toHaveBeenCalled();
    expect(dispatch.dispatchCampaign).toHaveBeenCalledWith(ORG_ID, CAMPAIGN_ID);
    expect(result).toMatchObject({ queued: 1, campaignId: CAMPAIGN_ID, sent: 3 });
  });
});
