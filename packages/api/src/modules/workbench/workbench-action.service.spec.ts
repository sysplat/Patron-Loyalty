import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STATION_CAPABILITIES } from '@queueplatform/shared';
import { WorkbenchActionService } from './workbench-action.service';

describe('WorkbenchActionService', () => {
  const mockTicketService = {
    callNext: vi.fn(),
    callSpecific: vi.fn(),
    serve: vi.fn(),
    recall: vi.fn(),
    complete: vi.fn(),
    repairJourneyFlowQueueLinks: vi.fn().mockResolvedValue({ repaired: 0 }),
    noShow: vi.fn(),
    markReady: vi.fn(),
    cancel: vi.fn(),
    bringToFirst: vi.fn(),
  };

  const mockWorkbenchService = {
    assertQueueCapabilityForProfile: vi.fn(),
    assertTicketCapabilityForProfile: vi.fn(),
    assertQueueAllowsManualPrioritize: vi.fn(),
    buildWorkbenchWorkItemFromIssued: vi.fn(),
    getStationProfileById: vi.fn(),
    repairJourneyProfileQueues: vi.fn(),
    resolveActiveFlowTemplateId: vi.fn(),
    resolveBranchIdForQueue: vi.fn(),
    ensureJourneySessionAtDesk: vi.fn(),
    requireActiveJourneyDeskSession: vi.fn(),
    resolveDeskForJourneyQueueCall: vi.fn().mockResolvedValue('2'),
  };

  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
    roleAssignment: {
      findMany: vi.fn().mockResolvedValue([{ role: { name: 'owner' } }]),
    },
  };

  let service: WorkbenchActionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkbenchActionService(
      mockTicketService as never,
      mockWorkbenchService as never,
      mockPrisma as never,
    );
    mockWorkbenchService.assertTicketCapabilityForProfile.mockResolvedValue({
      queueId: 'queue-1',
      branchId: 'branch-1',
    });
    mockWorkbenchService.getStationProfileById.mockResolvedValue({
      flowTemplateId: 'flow-1',
      branchId: 'branch-1',
    });
    mockWorkbenchService.repairJourneyProfileQueues.mockResolvedValue(false);
    mockWorkbenchService.resolveBranchIdForQueue.mockResolvedValue('branch-1');
    mockWorkbenchService.ensureJourneySessionAtDesk.mockResolvedValue({ id: 'session-1' });
    mockWorkbenchService.requireActiveJourneyDeskSession.mockResolvedValue({ deskNumber: '2' });
    mockWorkbenchService.resolveDeskForJourneyQueueCall.mockImplementation(
      async (_org, _user, _branch, _queue, requested) => requested,
    );
  });

  it('callNext ensures journey session at desk before delegating', async () => {
    mockTicketService.callNext.mockResolvedValue({ id: 't-1', displayNumber: 'A001' });

    await service.callNext('org-1', 'user-1', {
      stationProfileId: 'profile-1',
      queueId: 'queue-1',
      deskNumber: '2',
    });

    expect(mockWorkbenchService.ensureJourneySessionAtDesk).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      expect.objectContaining({
        stationProfileId: 'profile-1',
        branchId: 'branch-1',
        deskNumber: '2',
      }),
    );
    expect(mockWorkbenchService.resolveDeskForJourneyQueueCall).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'branch-1',
      'queue-1',
      '2',
    );
    expect(mockTicketService.callNext).toHaveBeenCalledWith(
      'org-1',
      'queue-1',
      '2',
      'user-1',
      true,
      'workbench',
    );
  });

  it('callSpecific ensures journey session at desk before delegating', async () => {
    mockTicketService.callSpecific.mockResolvedValue({ id: 't-1', displayNumber: 'A002' });

    await service.callSpecific('org-1', 'user-1', {
      stationProfileId: 'profile-1',
      ticketId: 'ticket-1',
      deskNumber: '3',
    });

    expect(mockWorkbenchService.ensureJourneySessionAtDesk).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      expect.objectContaining({ deskNumber: '3', branchId: 'branch-1' }),
    );
    expect(mockWorkbenchService.resolveDeskForJourneyQueueCall).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'branch-1',
      'queue-1',
      '3',
    );
    expect(mockTicketService.callSpecific).toHaveBeenCalledWith(
      'org-1',
      'ticket-1',
      '3',
      'user-1',
      'workbench',
    );
  });

  it('complete returns next workbench item when journey advances', async () => {
    mockTicketService.complete.mockResolvedValue({
      ticket: { id: 'ticket-1', status: 'completed' },
      nextTicket: { id: 'ticket-2', queueId: 'queue-lab' },
    });
    mockWorkbenchService.buildWorkbenchWorkItemFromIssued.mockResolvedValue({
      id: 'ticket-2',
      queueId: 'queue-lab',
      displayNumber: 'A001',
      status: 'waiting',
      allowedActions: ['call_specific'],
    });

    const result = await service.complete('org-1', 'user-1', {
      stationProfileId: 'profile-1',
      ticketId: 'ticket-1',
      externalRef: 'R-100',
    });

    expect(mockWorkbenchService.assertTicketCapabilityForProfile).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'profile-1',
      'ticket-1',
      STATION_CAPABILITIES.COMPLETE,
    );
    expect(mockTicketService.complete).toHaveBeenCalledWith(
      'org-1',
      'ticket-1',
      'user-1',
      'R-100',
      'workbench',
    );
    expect(mockWorkbenchService.requireActiveJourneyDeskSession).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      expect.objectContaining({
        stationProfileId: 'profile-1',
        branchId: 'branch-1',
        actionLabel: 'Cannot complete ticket',
      }),
    );
    expect(mockWorkbenchService.resolveDeskForJourneyQueueCall).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'branch-1',
      'queue-1',
      '2',
    );
    expect(mockWorkbenchService.buildWorkbenchWorkItemFromIssued).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'profile-1',
      expect.objectContaining({ id: 'ticket-2' }),
    );
    expect(result.nextWorkbenchItem).toMatchObject({ id: 'ticket-2', queueId: 'queue-lab' });
  });

  it('complete omits next workbench item when journey does not advance', async () => {
    mockTicketService.complete.mockResolvedValue({
      ticket: { id: 'ticket-1', status: 'completed' },
      nextTicket: null,
    });

    const result = await service.complete('org-1', 'user-1', {
      stationProfileId: 'profile-1',
      ticketId: 'ticket-1',
    });

    expect(mockWorkbenchService.buildWorkbenchWorkItemFromIssued).not.toHaveBeenCalled();
    expect(result.nextWorkbenchItem).toBeNull();
  });

  it('noShow delegates to ticketService with workbench surface', async () => {
    mockTicketService.noShow.mockResolvedValue({ id: 'ticket-1', status: 'no_show' });

    await service.noShow('org-1', 'user-1', {
      stationProfileId: 'profile-1',
      ticketId: 'ticket-1',
    });

    expect(mockWorkbenchService.assertTicketCapabilityForProfile).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'profile-1',
      'ticket-1',
      STATION_CAPABILITIES.NO_SHOW,
    );
    expect(mockTicketService.noShow).toHaveBeenCalledWith(
      'org-1',
      'ticket-1',
      'user-1',
      'workbench',
    );
  });

  it('recall delegates to ticketService with resolved desk for SMS', async () => {
    mockTicketService.recall.mockResolvedValue({ id: 'ticket-1', status: 'called' });
    mockWorkbenchService.resolveDeskForJourneyQueueCall.mockResolvedValue('2');

    await service.recall('org-1', 'user-1', {
      stationProfileId: 'profile-1',
      ticketId: 'ticket-1',
    });

    expect(mockWorkbenchService.assertTicketCapabilityForProfile).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'profile-1',
      'ticket-1',
      STATION_CAPABILITIES.SERVE,
    );
    expect(mockTicketService.recall).toHaveBeenCalledWith(
      'org-1',
      'ticket-1',
      'user-1',
      'workbench',
      '2',
    );
  });
});
