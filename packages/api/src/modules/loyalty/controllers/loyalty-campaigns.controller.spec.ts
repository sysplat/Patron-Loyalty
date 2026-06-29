import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyCampaignsController } from './loyalty-campaigns.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyCampaignsController', () => {
  const campaigns = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    launch: vi.fn(),
  };
  let controller: LoyaltyCampaignsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyCampaignsController(campaigns as never);
  });

  it('lists campaigns for org', async () => {
    campaigns.list.mockResolvedValue([]);
    await controller.listCampaigns(USER);
    expect(campaigns.list).toHaveBeenCalledWith(ORG_ID);
  });

  it('creates campaign with parsed schedule', async () => {
    campaigns.create.mockResolvedValue({ id: 'camp-1' });
    await controller.createCampaign(USER, {
      name: 'Summer promo',
      scheduledAt: '2026-07-01T12:00:00.000Z',
    } as never);
    expect(campaigns.create).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        name: 'Summer promo',
        scheduledAt: new Date('2026-07-01T12:00:00.000Z'),
      }),
    );
  });

  it('updates campaign', async () => {
    await controller.updateCampaign(USER, 'camp-1', { name: 'Renamed' } as never);
    expect(campaigns.update).toHaveBeenCalledWith(ORG_ID, 'camp-1', { name: 'Renamed' });
  });

  it('launches campaign', async () => {
    campaigns.launch.mockResolvedValue({ status: 'active' });
    await controller.launchCampaign(USER, 'camp-1');
    expect(campaigns.launch).toHaveBeenCalledWith(ORG_ID, 'camp-1');
  });
});
