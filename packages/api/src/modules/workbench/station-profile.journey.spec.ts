import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StationProfileService } from './station-profile.service';
import { DEFAULT_PICKUP_CAPABILITIES, STATION_CAPABILITIES } from '@queueplatform/shared';

describe('StationProfileService — journey provisioning', () => {
  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    branchFlowTemplate: { findFirst: vi.fn() },
    branchFlowStep: { findMany: vi.fn() },
    stationProfile: { findFirst: vi.fn() },
    stationProfileQueue: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
    queue: { findMany: vi.fn() },
    branch: { findFirst: vi.fn() },
    withTenant: vi.fn((orgId: string, cb: any) => cb(mockPrisma)),
  };

  let service: StationProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StationProfileService(mockPrisma as never);
    vi.spyOn(service, 'create').mockResolvedValue({ id: 'profile-combined' } as never);
  });

  it('repairJourneyProfileQueues adds missing flow-step queues to the profile', async () => {
    mockPrisma.branchFlowStep.findMany.mockResolvedValue([
      { queueId: 'q-reception', stepRole: 'service' },
      { queueId: 'q-lab', stepRole: 'service' },
      { queueId: 'q-pickup', stepRole: 'pickup' },
    ]);
    mockPrisma.stationProfileQueue.updateMany.mockResolvedValue({ count: 1 });
    // Current profile is missing q-lab (added to the flow later).
    mockPrisma.stationProfileQueue.findMany.mockResolvedValue([
      { queueId: 'q-reception', visibilityOnly: false, capabilities: [] },
      { queueId: 'q-pickup', visibilityOnly: false, capabilities: [] },
    ]);
    mockPrisma.stationProfile.findFirst.mockResolvedValue({
      branchId: 'branch-1',
      queues: [
        { queueId: 'q-reception', sortOrder: 0 },
        { queueId: 'q-pickup', sortOrder: 1 },
      ],
    });
    mockPrisma.queue.findMany.mockResolvedValue([{ id: 'q-lab' }]);
    mockPrisma.stationProfileQueue.createMany.mockResolvedValue({ count: 1 });

    await service.repairJourneyProfileQueues('org-1', 'profile-combined', 'flow-1');

    expect(mockPrisma.stationProfileQueue.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ queueId: 'q-lab', stationProfileId: 'profile-combined' }),
        ]),
      }),
    );
  });

  it('repairJourneyProfileQueues clears visibility-only and restores mark_ready on pickup', async () => {
    mockPrisma.branchFlowStep.findMany.mockResolvedValue([
      { queueId: 'q-pickup', stepRole: 'pickup' },
      { queueId: 'q-service', stepRole: 'service' },
    ]);
    mockPrisma.stationProfileQueue.updateMany.mockResolvedValue({ count: 1 });
    // q-pickup is currently visibility-only and must be repaired to mark_ready.
    mockPrisma.stationProfileQueue.findMany.mockResolvedValue([
      { queueId: 'q-pickup', visibilityOnly: true, capabilities: [] },
      { queueId: 'q-service', visibilityOnly: false, capabilities: [] },
    ]);
    mockPrisma.stationProfile.findFirst.mockResolvedValue({
      branchId: 'branch-1',
      queues: [
        { queueId: 'q-pickup', sortOrder: 0 },
        { queueId: 'q-service', sortOrder: 1 },
      ],
    });

    await service.repairJourneyProfileQueues('org-1', 'profile-combined', 'flow-1');

    expect(mockPrisma.stationProfileQueue.updateMany).toHaveBeenCalledWith({
      where: { orgId: 'org-1', stationProfileId: 'profile-combined', queueId: 'q-pickup' },
      data: {
        visibilityOnly: false,
        capabilities: DEFAULT_PICKUP_CAPABILITIES,
      },
    });
    expect(mockPrisma.stationProfileQueue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ queueId: 'q-service' }),
      }),
    );
  });

  it('ensureCombinedCounterProfile repairs an existing Combined counter', async () => {
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      id: 'flow-1',
      branchId: 'branch-1',
      steps: [
        { queueId: 'q1', stepRole: 'service', queue: {} },
        { queueId: 'q2', stepRole: 'pickup', queue: {} },
      ],
    });
    mockPrisma.stationProfile.findFirst.mockResolvedValue({ id: 'profile-combined' });
    const repairSpy = vi.spyOn(service, 'repairJourneyProfileQueues').mockResolvedValue(false);

    const id = await service.ensureCombinedCounterProfile('org-1', 'user-1', 'flow-1');

    expect(id).toBe('profile-combined');
    expect(repairSpy).toHaveBeenCalledWith('org-1', 'profile-combined', 'flow-1');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('provisionJourneyStationProfiles returns combined id after ensure and repair', async () => {
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({ id: 'flow-1' });
    vi.spyOn(service, 'ensureCombinedCounterProfile').mockResolvedValue('profile-combined');
    const repairSpy = vi.spyOn(service, 'repairJourneyProfileQueues').mockResolvedValue(false);

    const id = await service.provisionJourneyStationProfiles('org-1', 'user-1', 'branch-1');

    expect(id).toBe('profile-combined');
    expect(repairSpy).toHaveBeenCalledWith('org-1', 'profile-combined', 'flow-1');
  });
});

describe('journeyProfileSupportsMarkReady', () => {
  it('returns false for visibility-only lanes', async () => {
    const { journeyProfileSupportsMarkReady } = await import('@queueplatform/shared');
    expect(journeyProfileSupportsMarkReady(true, [STATION_CAPABILITIES.MARK_READY])).toBe(false);
  });

  it('returns true when mark_ready capability is present', async () => {
    const { journeyProfileSupportsMarkReady } = await import('@queueplatform/shared');
    expect(journeyProfileSupportsMarkReady(false, [STATION_CAPABILITIES.MARK_READY])).toBe(true);
  });
});
