import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketService } from './ticket.service';
import { mockRequestContext } from '../../test/mock-request-context';

/**
 * Journey complete must be safe under double-submit: row lock prevents duplicate
 * next-step issuance; idempotent retries return the existing follow-up ticket.
 */
describe('TicketService — journey complete idempotency', () => {
  const orgId = 'org-1';
  const ticketId = 'ticket-1';

  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    ticket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    queue: { findUnique: vi.fn(), findFirst: vi.fn() },
    branch: { findUnique: vi.fn(), findFirst: vi.fn() },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC', visitJourneysEnabled: true }),
    },
    branchFlowTemplate: { findFirst: vi.fn() },
    branchFlowStep: { findFirst: vi.fn(), findMany: vi.fn() },
    branchService: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    visit: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    withTenant: vi.fn(),
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
  const mockStaffGuards = {
    assertQueueNotClosedForStaffActions: vi.fn().mockResolvedValue(undefined),
    assertClassicDeskAssignmentForBranch: vi.fn().mockResolvedValue(undefined),
  };

  let service: TicketService;

  const journeyContext = {
    id: ticketId,
    visitId: 'visit-1',
    stepIndex: 1,
    branchId: 'branch-1',
    queueId: 'queue-1',
    customerId: null,
    customerName: 'Alice',
    customerPhone: null,
    language: 'en',
    externalRef: null,
    queue: { stepRole: 'service' as const },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'UTC' });
    mockPrisma.branch.findUnique.mockResolvedValue({
      orgId,
      defaultJourneyMode: 'visit_multi_step',
    });
    mockPrisma.queue.findUnique.mockResolvedValue({
      id: 'queue-1',
      branchId: 'branch-1',
      status: 'open',
      journeyModeOverride: 'visit_multi_step',
      flowTemplateId: 'tpl-1',
    });
    mockPrisma.service.findUnique.mockResolvedValue({ journeyModeOverride: null });
    mockPrisma.branchService.findUnique.mockResolvedValue({ journeyModeOverride: null });
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({ id: 'tpl-1' });
    mockPrisma.branchFlowStep.findFirst.mockResolvedValue(null);
    mockPrisma.branchFlowStep.findMany.mockResolvedValue([]);
    // Next-step queue resolves cleanly so resolution never short-circuits with an error;
    // these tests exercise the idempotency/lock behavior, not queue-repair.
    mockPrisma.queue.findFirst.mockResolvedValue({
      id: 'queue-2',
      serviceId: 'service-2',
      branchId: 'branch-1',
      status: 'open',
      orgId,
    });
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockPrisma.ticket.findMany.mockResolvedValue([]);
    mockPrisma.withTenant.mockImplementation(
      async (_org: string, cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma as never),
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

  it('returns follow-up ticket when complete is retried after the source is already completed', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue(journeyContext);
    mockWorkflow.getNextStep.mockResolvedValue(null);
    mockPrisma.$queryRaw.mockResolvedValue([
      { status: 'completed', visitId: 'visit-1', stepIndex: 1 },
    ]);
    mockPrisma.ticket.findFirst
      .mockResolvedValueOnce({
        id: ticketId,
        displayNumber: 'A001',
        queue: { id: 'queue-1', name: 'Reception' },
        service: { id: 'service-1', name: 'Consult' },
      })
      .mockResolvedValueOnce({
        id: 'ticket-2',
        displayNumber: 'A002',
        queue: { id: 'queue-2', name: 'Lab' },
        service: { id: 'service-2', name: 'Lab' },
        status: 'waiting',
      });

    const result = await service.complete(orgId, ticketId, 'user-1', undefined, 'workbench');

    expect(result.ticket).toMatchObject({ id: ticketId, displayNumber: 'A001' });
    expect(result.nextTicket).toMatchObject({ id: 'ticket-2', displayNumber: 'A002' });
    expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
  });

  it('does not call issueTicketCore when the locked row is already completed', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue(journeyContext);
    mockWorkflow.getNextStep.mockResolvedValue({
      queueId: 'queue-2',
      serviceId: 'service-2',
      stepIndex: 2,
    });
    mockPrisma.$queryRaw.mockResolvedValue([
      { status: 'completed', visitId: 'visit-1', stepIndex: 1 },
    ]);
    mockPrisma.ticket.findFirst
      .mockResolvedValueOnce({
        id: ticketId,
        displayNumber: 'A001',
        queue: { id: 'queue-1', name: 'Reception' },
        service: { id: 'service-1', name: 'Consult' },
      })
      .mockResolvedValueOnce({
        id: 'ticket-2',
        displayNumber: 'A002',
        status: 'waiting',
      });

    const issueSpy = vi
      .spyOn(service as unknown as { issueTicketCore: () => Promise<unknown> }, 'issueTicketCore')
      .mockResolvedValue({ id: 'ticket-2' });

    await service.complete(orgId, ticketId, 'user-1', undefined, 'workbench');

    expect(issueSpy).not.toHaveBeenCalled();
    issueSpy.mockRestore();
  });

  it('invokes finalize logic on every complete request (idempotency handled inside transaction)', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue({
      id: ticketId,
      visitId: 'visit-1',
      stepIndex: 1,
      queueId: 'queue-1',
    });

    const finalizeSpy = vi
      .spyOn(
        service as unknown as { finalizeTicketWithJourneyAdvance: () => Promise<unknown> },
        'finalizeTicketWithJourneyAdvance',
      )
      .mockResolvedValue({ ticket: { id: ticketId, status: 'completed' }, nextTicket: null });

    await service.complete(orgId, ticketId, 'user-1', undefined, 'workbench');
    await service.complete(orgId, ticketId, 'user-1', undefined, 'workbench');

    expect(finalizeSpy).toHaveBeenCalledTimes(2);
    finalizeSpy.mockRestore();
  });
});
