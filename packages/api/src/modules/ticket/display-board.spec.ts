import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketService } from './ticket.service';
import { mockRequestContext } from '../../test/mock-request-context';

/**
 * Token-secured lobby board: day-scoped live rows, open desk count, no PII.
 */
describe('TicketService — display board', () => {
  const mockPrisma = {
    ticket: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    desk: { count: vi.fn() },
    branch: { findFirst: vi.fn() },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC', visitJourneysEnabled: false }),
    },
    withTenant: vi.fn(),
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  };

  const mockRedis = {
    del: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getJson: vi.fn().mockResolvedValue('America/New_York'),
    setJson: vi.fn(),
  };

  const mockConfig = { get: vi.fn() };
  const mockNotifications = {
    notifyTicketCalled: vi.fn(),
    notifyTicketIssued: vi.fn(),
    notifyTicketAlmostReady: vi.fn(),
    notifyTicketRecalled: vi.fn(),
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
  const mockWorkflow = { getActiveTemplateForBranch: vi.fn() };
  const mockStaffGuards = {
    assertQueueNotClosedForStaffActions: vi.fn().mockResolvedValue(undefined),
    assertClassicDeskAssignmentForBranch: vi.fn().mockResolvedValue(undefined),
  };

  let service: TicketService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.withTenant.mockImplementation(
      async (_orgId: string, cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    service = new TicketService(
      mockPrisma as any,
      mockRedis as any,
      mockConfig as any,
      mockNotifications as any,
      mockAudit as any,
      mockPlanLimits as any,
      mockWorkflow as any,
      mockRequestContext as any,
      mockStaffGuards as any,
    );
  });

  it('throws when branch is missing', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue(null);
    await expect(service.getPublicDisplayBoard('missing-branch')).rejects.toThrow(
      'Branch not found',
    );
  });

  it('returns display-safe rows with openDesks from desk count', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ orgId: 'org-1' });
    const calledAt = new Date('2026-05-12T10:00:00.000Z');
    mockPrisma.ticket.findMany
      .mockResolvedValueOnce([
        {
          id: 't1',
          displayNumber: 'A001',
          deskNumber: '3',
          status: 'called',
          calledAt,
          servedAt: null,
          queue: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.ticket.count.mockResolvedValue(7);
    mockPrisma.desk.count.mockResolvedValue(2);

    const result = await service.getPublicDisplayBoard('branch-1');

    expect(result.data).toEqual([
      {
        id: 't1',
        displayNumber: 'A001',
        deskNumber: '3',
        status: 'called',
        isJourneyManaged: false,
        queueName: undefined,
      },
    ]);
    expect(result.meta.total).toBe(7);
    expect(result.meta.openDesks).toBe(2);
    expect(result.meta.branchId).toBe('branch-1');
  });

  it('scopes called/serving tickets to today branch-local session', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ orgId: 'org-1' });
    mockPrisma.ticket.findMany.mockResolvedValue([]);
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockPrisma.desk.count.mockResolvedValue(1);

    await service.getPublicDisplayBoard('branch-1');

    const calledQuery = mockPrisma.ticket.findMany.mock.calls[0][0];
    expect(calledQuery.where.status).toEqual({ in: ['called', 'serving'] });
    expect(calledQuery.where.bookedAt).toEqual(expect.objectContaining({ gte: expect.any(Date) }));
    expect(mockPrisma.desk.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 'branch-1', status: 'open' }),
      }),
    );
  });

  it('deduplicates display numbers by prioritizing called/serving over waiting over completed tickets', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ orgId: 'org-1' });

    // Return same displayNumber in multiple queries
    // Query 1: Called/Serving
    mockPrisma.ticket.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        displayNumber: 'A001',
        status: 'called',
        deskNumber: '1',
        isJourneyManaged: false,
        queue: null,
      },
    ]);

    // Query 2: Waiting
    mockPrisma.ticket.findMany.mockResolvedValueOnce([
      { id: 't2', displayNumber: 'A002', status: 'waiting', isJourneyManaged: false, queue: null },
      { id: 't3', displayNumber: 'A001', status: 'waiting', isJourneyManaged: false, queue: null }, // duplicate!
    ]);

    // Query 3: Completed
    mockPrisma.ticket.findMany.mockResolvedValueOnce([
      {
        id: 't4',
        displayNumber: 'A001',
        status: 'completed',
        isJourneyManaged: false,
        queue: null,
      }, // duplicate!
      {
        id: 't5',
        displayNumber: 'A002',
        status: 'completed',
        isJourneyManaged: false,
        queue: null,
      }, // duplicate!
    ]);

    mockPrisma.ticket.count.mockResolvedValue(4);
    mockPrisma.desk.count.mockResolvedValue(1);

    const result = await service.getPublicDisplayBoard('branch-1');

    // We expect A001 to ONLY appear as called (data array)
    expect(result.data.filter((t) => t.displayNumber === 'A001').length).toBe(1);
    expect(result.upcoming.filter((t) => t.displayNumber === 'A001').length).toBe(0);
    expect(result.recentlyCompleted.filter((t) => t.displayNumber === 'A001').length).toBe(0);

    // We expect A002 to ONLY appear as waiting (upcoming array)
    expect(result.data.filter((t) => t.displayNumber === 'A002').length).toBe(0);
    expect(result.upcoming.filter((t) => t.displayNumber === 'A002').length).toBe(1);
    expect(result.recentlyCompleted.filter((t) => t.displayNumber === 'A002').length).toBe(0);
  });
});
