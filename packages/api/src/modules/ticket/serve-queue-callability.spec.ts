import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketService } from './ticket.service';
import { TicketStaffGuardService } from './ticket-staff-guard.service';

import { mockRequestContext } from '../../test/mock-request-context';

/**
 * Serve actions on paused vs closed queues — staff may call waiting customers
 * while a line is paused; stopped (closed) queues reject call-next.
 */
describe('TicketService — serve queue callability', () => {
  const orgId = 'org-1';
  const queueId = 'queue-1';
  const deskNumber = '1';
  const userId = 'user-1';

  const mockPrisma = {
    ticket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    desk: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    queue: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    branch: { findFirst: vi.fn(), findUnique: vi.fn() },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC', visitJourneysEnabled: false }),
    },
    roleAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    branchFlowTemplate: { findFirst: vi.fn() },
    branchFlowStep: { findFirst: vi.fn() },
    withTenant: vi.fn(),
    withBypassRls: vi.fn(),
    $queryRaw: vi.fn(),
  };

  const mockRedis = {
    del: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getJson: vi.fn(),
    setJson: vi.fn(),
    publishTrackQueues: vi.fn().mockResolvedValue(undefined),
    publishTrackVisits: vi.fn().mockResolvedValue(undefined),
  };

  const mockConfig = { get: vi.fn() };
  const mockNotifications = {
    notifyTicketCalled: vi.fn().mockResolvedValue(undefined),
    notifyTicketIssued: vi.fn().mockResolvedValue(undefined),
    notifyTicketAlmostReady: vi.fn().mockResolvedValue(undefined),
    notifyTicketRecalled: vi.fn().mockResolvedValue(undefined),
  };
  const mockAudit = { logActivity: vi.fn(), logAudit: vi.fn() };
  const mockPlanLimits = {
    checkLimit: vi.fn().mockResolvedValue({
      allowed: true,
      limitReached: false,
      limit: 1000,
      current: 0,
      feature: 'maxTicketsPerMonth',
    }),
    getLimits: vi.fn().mockResolvedValue({}),
    requireFeature: vi.fn().mockResolvedValue(undefined),
  };
  const mockWorkflow = { getNextStep: vi.fn() };
  const mockBranchHours = {
    assertBranchAcceptsCustomerIntake: vi.fn().mockResolvedValue(undefined),
  };
  let service: TicketService;
  let staffGuards: TicketStaffGuardService;
  let txMock: {
    queue: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    desk: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    branch: { findFirst: ReturnType<typeof vi.fn> };
    ticket: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    roleAssignment: { findMany: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.desk.count.mockResolvedValue(1);
    mockPrisma.desk.findMany.mockResolvedValue([{ number: '1' }]);
    mockPrisma.desk.findUnique.mockResolvedValue({ status: 'open' });
    mockPrisma.queue.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'UTC' });
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue(null);
    mockPrisma.branchFlowStep.findFirst.mockResolvedValue(null);
    mockPrisma.ticket.findMany.mockResolvedValue([]);
    mockPrisma.ticket.count.mockResolvedValue(0);

    txMock = {
      queue: {
        findFirst: vi.fn().mockResolvedValue({ branchId: 'branch-1' }),
        findUnique: vi.fn(),
      },
      desk: {
        findUnique: vi.fn().mockResolvedValue({ status: 'open' }),
        findMany: vi.fn().mockResolvedValue([{ number: '1' }]),
      },
      branch: {
        findFirst: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
      ticket: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ticket-waiting',
          queueId,
          visitId: null,
          stepIndex: null,
          status: 'waiting',
          readyAt: null,
          bookedAt: new Date(),
          branchId: 'branch-1',
        }),
        findFirst: vi.fn().mockResolvedValue({ queueId }),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'tid-1',
            displayNumber: 'A001',
            branchId: 'branch-1',
            queueId,
            customerPhone: null,
            queue: { name: 'Main' },
            ...data,
          }),
        ),
      },
      roleAssignment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'tid-1' }]),
    };

    mockPrisma.withTenant.mockImplementation(
      async (_org: string, cb: (tx: unknown) => Promise<unknown>) => cb(txMock as never),
    );
    mockPrisma.withBypassRls.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(mockPrisma as never),
    );

    staffGuards = new TicketStaffGuardService(mockPrisma as any, mockBranchHours as any);
    service = new TicketService(
      mockPrisma as never,
      mockRedis as never,
      mockConfig as never,
      mockNotifications as never,
      mockAudit as never,
      mockPlanLimits as never,
      mockWorkflow as never,
      mockRequestContext as never,
      staffGuards as never,
    );
  });

  function mockQueueStatus(status: 'open' | 'paused' | 'closed') {
    const row = {
      branchId: 'branch-1',
      status,
      callingPolicy: 'fifo',
      stepRole: 'service',
      flowTemplateId: null,
    };
    txMock.queue.findUnique.mockResolvedValue(row);
  }

  it('callNext succeeds when the queue is paused', async () => {
    mockQueueStatus('paused');

    await expect(service.callNext(orgId, queueId, deskNumber, userId)).resolves.toBeDefined();
    expect(txMock.ticket.update).toHaveBeenCalled();
    expect(txMock.$queryRaw).toHaveBeenCalled();
  });

  it('callNext rejects when the queue is closed', async () => {
    mockQueueStatus('closed');

    await expect(service.callNext(orgId, queueId, deskNumber, userId)).rejects.toThrow(
      /Queue is closed/i,
    );
    expect(txMock.$queryRaw).not.toHaveBeenCalled();
    expect(txMock.ticket.update).not.toHaveBeenCalled();
  });

  it('callSpecific succeeds when the queue is paused', async () => {
    txMock.queue.findUnique.mockResolvedValue({
      branchId: 'branch-1',
      status: 'paused',
      callingPolicy: 'manual_only',
      stepRole: 'service',
      flowTemplateId: null,
    });
    txMock.ticket.findFirst.mockResolvedValue({ queueId });

    await expect(
      service.callSpecific(orgId, 'ticket-waiting', deskNumber, userId, 'classic'),
    ).resolves.toBeDefined();
    expect(txMock.ticket.update).toHaveBeenCalled();
  });

  it('callSpecific rejects when the queue is closed', async () => {
    txMock.queue.findUnique.mockResolvedValue({
      branchId: 'branch-1',
      status: 'closed',
      callingPolicy: 'manual_only',
      stepRole: 'service',
      flowTemplateId: null,
    });
    txMock.ticket.findFirst.mockResolvedValue({ queueId });

    await expect(
      service.callSpecific(orgId, 'ticket-waiting', deskNumber, userId, 'classic'),
    ).rejects.toThrow(/Queue is closed/i);
    expect(txMock.$queryRaw).not.toHaveBeenCalled();
  });
});
