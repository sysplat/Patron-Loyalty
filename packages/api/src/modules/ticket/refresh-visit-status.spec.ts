/**
 * Tests for the refreshVisitStatus fix:
 * When a journey ticket is no_show'd or cancelled, the visit should be closed
 * immediately instead of staying 'active' with zero tickets.
 *
 * Previously, refreshVisitStatus would see remaining flow steps and mark
 * the visit as 'active' even after a no_show, creating an orphan visit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketService } from './ticket.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';
import { mockRequestContext } from '../../test/mock-request-context';

describe('TicketService — refreshVisitStatus no-show journey fix', () => {
  let service: TicketService;

  const visitId = 'visit-abc';
  const orgId = 'org-1';

  const mockPrisma = {
    ticket: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    visit: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    branchFlowTemplate: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'visit-1' }]),
    organization: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
    },
    queue: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    withTenant: vi.fn(),
    withBypassRls: vi.fn(),
  };

  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn().mockResolvedValue(0),
    getJson: vi.fn().mockResolvedValue(null),
    publish: vi.fn().mockResolvedValue(0),
    publishTrackQueues: vi.fn().mockResolvedValue(undefined),
    publishTrackVisits: vi.fn().mockResolvedValue(undefined),
  };
  const mockConfig = { get: vi.fn().mockReturnValue(true) };
  const mockNotification = {
    notifyTicketIssued: vi.fn().mockResolvedValue(undefined),
  };
  const mockAudit = {
    log: vi.fn().mockResolvedValue(undefined),
  };
  const mockPlanLimits = { checkLimit: vi.fn().mockResolvedValue({ limitReached: false }) };
  const mockWorkflow = { getNextStep: vi.fn() };
  const mockStaffGuards = {
    assertQueueNotClosedForStaffActions: vi.fn().mockResolvedValue(undefined),
    assertClassicDeskAssignmentForBranch: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    service = new TicketService(
      mockPrisma as any,
      mockRedis as any,
      mockConfig as any,
      mockNotification as any,
      mockAudit as any,
      mockPlanLimits as any,
      mockWorkflow as any,
      mockRequestContext as any,
      mockStaffGuards as any,
    );
  });

  // Access the private method for testing
  function callRefreshVisitStatus(): Promise<void> {
    return (service as any).refreshVisitStatus(orgId, visitId);
  }

  it('skips processing when visitId is null', async () => {
    await (service as any).refreshVisitStatus(orgId, null);
    expect(mockPrisma.ticket.count).not.toHaveBeenCalled();
  });

  it('marks visit active when tickets are still in progress', async () => {
    mockPrisma.ticket.count.mockResolvedValue(1);
    await callRefreshVisitStatus();
    expect(mockPrisma.visit.update).toHaveBeenCalledWith({
      where: { id: visitId },
      data: { status: 'active', completedAt: null },
    });
  });

  it('closes visit as completed when last ticket is completed and no next step', async () => {
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      visitId,
      branchId: 'branch-1',
      queueId: 'q-1',
      stepIndex: 1,
      status: 'completed',
      customerId: null,
      customerName: null,
      customerPhone: null,
      language: null,
      externalRef: null,
    });
    // No active flow template → no next step
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue(null);
    // resolveVisitExternalRef fallback
    mockPrisma.visit.findUnique.mockResolvedValue(null);

    await callRefreshVisitStatus();
    expect(mockPrisma.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: visitId },
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('DOES NOT keep visit active when last ticket is no_show — even if next step exists', async () => {
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      visitId,
      branchId: 'branch-1',
      queueId: 'q-order',
      stepIndex: 1,
      status: 'no_show',
      customerId: null,
      customerName: null,
      customerPhone: null,
      language: null,
      externalRef: null,
    });

    // A next step exists (but should NOT be checked for no_show)
    mockWorkflow.getNextStep.mockResolvedValue({
      stepIndex: 2,
      queueId: 'q-pickup',
      serviceId: 'svc-pickup',
    });
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      isActive: true,
    });
    // resolveVisitExternalRef fallback
    mockPrisma.visit.findUnique.mockResolvedValue(null);

    await callRefreshVisitStatus();

    // Should be completed (abandoned), NOT active
    expect(mockPrisma.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: visitId },
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );

    // Should NOT have tried to resolve the next journey step (short-circuited)
    expect(mockWorkflow.getNextStep).not.toHaveBeenCalled();
  });

  it('DOES NOT keep visit active when last ticket is cancelled — even if next step exists', async () => {
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      visitId,
      branchId: 'branch-1',
      queueId: 'q-order',
      stepIndex: 1,
      status: 'cancelled',
      customerId: null,
      customerName: null,
      customerPhone: null,
      language: null,
      externalRef: null,
    });

    // A next step exists (but should NOT be checked for cancelled)
    mockWorkflow.getNextStep.mockResolvedValue({
      stepIndex: 2,
      queueId: 'q-pickup',
      serviceId: 'svc-pickup',
    });
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      isActive: true,
    });
    // resolveVisitExternalRef fallback
    mockPrisma.visit.findUnique.mockResolvedValue(null);

    await callRefreshVisitStatus();

    // Should be completed, NOT active
    expect(mockPrisma.visit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: visitId },
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );

    // Should NOT have tried to resolve the next journey step (short-circuited)
    expect(mockWorkflow.getNextStep).not.toHaveBeenCalled();
  });

  it('DOES advance to next step when last ticket is completed and next step exists', async () => {
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockPrisma.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      visitId,
      branchId: 'branch-1',
      queueId: 'q-order',
      stepIndex: 1,
      status: 'completed',
      customerId: null,
      customerName: null,
      customerPhone: null,
      language: null,
      externalRef: null,
    });

    // Active flow template with a next step
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      isActive: true,
    });
    mockWorkflow.getNextStep.mockResolvedValue({
      stepIndex: 2,
      queueId: 'q-pickup',
      serviceId: 'svc-pickup',
    });
    // The next-step queue must resolve for resolveNextJourneyStep to return a step.
    mockPrisma.queue.findFirst.mockResolvedValue({
      id: 'q-pickup',
      serviceId: 'svc-pickup',
      branchId: 'branch-1',
      orgId,
      status: 'open',
    });

    await callRefreshVisitStatus();

    // Visit should stay active (next step awaits)
    expect(mockPrisma.visit.update).toHaveBeenCalledWith({
      where: { id: visitId },
      data: { status: 'active', completedAt: null },
    });
  });
});
