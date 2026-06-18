import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketService } from './ticket.service';
import { mockRequestContext } from '../../test/mock-request-context';

describe('TicketService — isolated desk presence validation (Option E + F)', () => {
  const orgId = 'org-1';
  const queueId = 'q-1';
  const deskNumber = '5';
  const userId = 'user-1';

  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    ticket: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    queue: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ branchId: 'branch-1' }),
    },
    branch: {
      findFirst: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
    },
    desk: {
      findUnique: vi.fn(),
    },
    agentSession: {
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
    },
    roleAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    withTenant: vi.fn(),
    $queryRaw: vi.fn(),
  };

  const mockRedis = {
    del: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getJson: vi.fn().mockResolvedValue(null),
    setJson: vi.fn().mockResolvedValue(undefined),
    publishTrackQueues: vi.fn().mockResolvedValue(undefined),
    publishTrackVisits: vi.fn().mockResolvedValue(undefined),
  };

  const mockConfig = {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'app.visitJourneysGloballyDisabled') return false;
      if (key === 'app.surfaceIsolation.writeBlock') return true;
      return defaultValue;
    }),
  };

  const mockNotifications = {
    notifyTicketCalled: vi.fn().mockResolvedValue(undefined),
    notifyTicketIssued: vi.fn().mockResolvedValue(undefined),
    notifyTicketAlmostReady: vi.fn().mockResolvedValue(undefined),
    notifyTicketRecalled: vi.fn().mockResolvedValue(undefined),
  };

  const mockAudit = { logActivity: vi.fn(), logAudit: vi.fn() };
  const mockPlanLimits = { checkLimit: vi.fn(), getLimits: vi.fn(), requireFeature: vi.fn() };
  const mockWorkflow = { getNextStep: vi.fn() };
  const mockStaffGuards = {
    assertQueueNotClosedForStaffActions: vi.fn().mockResolvedValue(undefined),
    assertClassicDeskAssignmentForBranch: vi.fn().mockResolvedValue(undefined),
  };

  let service: TicketService;
  let txMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    txMock = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'ticket-1' }]),
      queue: {
        findFirst: vi.fn().mockResolvedValue({ branchId: 'branch-1' }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: queueId,
            branchId: 'branch-1',
            status: 'open',
            callingPolicy: 'fifo',
            journeyModeOverride: null,
            flowTemplateId: null,
          }),
        ),
      },
      desk: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ number: '5' }]),
      },
      agentSession: {
        findFirst: vi.fn(),
      },
      branch: {
        findFirst: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
      ticket: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ticket-1',
          status: 'waiting',
          queueId,
          branchId: 'branch-1',
          readyAt: new Date(),
        }),
        update: vi
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'ticket-1', ...data })),
      },
    };

    mockPrisma.withTenant.mockImplementation(
      async (_org: string, cb: (tx: unknown) => Promise<unknown>) => cb(txMock as never),
    );

    service = new TicketService(
      mockPrisma as never,
      mockRedis as never,
      mockConfig as never,
      mockNotifications as never,
      mockAudit as never,
      mockPlanLimits as never,
      mockWorkflow as never,
      mockRequestContext as never,
      mockStaffGuards as never,
    );
  });

  describe('callNext — Classic surface presence validation', () => {
    it('succeeds when physical Desk status is open', async () => {
      txMock.desk.findUnique.mockResolvedValue({ id: 'desk-1', status: 'open' });

      await service.callNext(orgId, queueId, deskNumber, userId, false, 'classic');

      expect(txMock.desk.findUnique).toHaveBeenCalledWith({
        where: { branchId_number: { branchId: 'branch-1', number: deskNumber } },
      });
      expect(txMock.ticket.update).toHaveBeenCalled();
    });

    it('throws BadRequestException when physical Desk is closed', async () => {
      txMock.desk.findUnique.mockResolvedValue({ id: 'desk-1', status: 'closed' });

      await expect(
        service.callNext(orgId, queueId, deskNumber, userId, false, 'classic'),
      ).rejects.toThrow(/Desk 5 is currently closed/i);
    });
  });

  describe('callNext — Workbench/Journey surface presence validation', () => {
    beforeEach(() => {
      txMock.queue.findUnique.mockResolvedValue({
        id: queueId,
        branchId: 'branch-1',
        status: 'open',
        callingPolicy: 'fifo',
        journeyModeOverride: 'visit_multi_step',
      });
    });

    it('succeeds when an active journey session exists, even if the physical Desk is closed', async () => {
      txMock.agentSession.findFirst.mockResolvedValue({ id: 'session-1', surface: 'journey' });

      await service.callNext(orgId, queueId, deskNumber, userId, false, 'workbench');

      expect(txMock.agentSession.findFirst).toHaveBeenCalledWith({
        where: {
          branchId: 'branch-1',
          deskNumber,
          surface: 'journey',
          endedAt: null,
          userId,
        },
      });
      // Should completely bypass querying the physical Desk
      expect(txMock.desk.findUnique).not.toHaveBeenCalled();
      expect(txMock.ticket.update).toHaveBeenCalled();
    });

    it('throws BadRequestException when no active workbench session exists', async () => {
      txMock.agentSession.findFirst.mockResolvedValue(null);

      await expect(
        service.callNext(orgId, queueId, deskNumber, userId, false, 'workbench'),
      ).rejects.toThrow(/workbench session required/i);
    });
  });
});
