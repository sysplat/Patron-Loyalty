import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AgentSessionService } from './agent-session.service';

describe('AgentSessionService.syncSessionForWorkbench', () => {
  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    roleAssignment: { findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
    desk: {
      findFirst: vi.fn(),
    },
    agentSession: {
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const mockStationProfileService = {
    getById: vi.fn(),
  };

  let service: AgentSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentSessionService(mockPrisma as never, mockStationProfileService as never);
    mockStationProfileService.getById.mockResolvedValue({ branchId: 'branch-1' });
  });

  it('updates desk on existing journey session using admin Desk records', async () => {
    const existing = {
      id: 'session-1',
      stationProfileId: 'profile-1',
      branchId: 'branch-1',
      deskNumber: '1',
      deskId: 'desk-1',
    };
    vi.spyOn(service, 'getActive').mockResolvedValue(existing as never);
    vi.spyOn(service, 'heartbeat').mockResolvedValue(existing as never);
    mockPrisma.desk.findFirst.mockResolvedValue({ id: 'desk-2', number: '2', name: 'Desk 2' });
    mockPrisma.agentSession.update.mockResolvedValue({});
    vi.spyOn(service, 'getActive')
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce({ ...existing, deskNumber: '2', deskId: 'desk-2' } as never);

    const result = await service.syncSessionForWorkbench('org-1', 'user-1', {
      branchId: 'branch-1',
      stationProfileId: 'profile-1',
      surface: 'journey',
      deskNumber: '2',
    });

    expect(mockPrisma.desk.findFirst).toHaveBeenCalledWith({
      where: { orgId: 'org-1', branchId: 'branch-1', number: '2' },
    });
    expect(mockPrisma.agentSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deskId: 'desk-2',
          deskNumber: '2',
        }),
      }),
    );
    expect(mockPrisma.agentSession.updateMany).toHaveBeenCalled();
    expect(result.deskNumber).toBe('2');
  });

  it('throws when profile branch mismatches', async () => {
    mockStationProfileService.getById.mockResolvedValue({ branchId: 'other-branch' });
    await expect(
      service.syncSessionForWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        stationProfileId: 'profile-1',
        surface: 'journey',
        deskNumber: '1',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
