import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketComplianceService } from './ticket-compliance.service';

vi.mock('../../common/resolve-effective-timezone', () => ({
  resolveBranchIanaZone: vi.fn().mockResolvedValue('America/Vancouver'),
}));

const mockPrisma = {
  branch: { findMany: vi.fn() },
  ticket: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  withBypassRls: vi.fn(),
  withTenant: vi.fn(),
};

const mockRedis = {
  del: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
};

const mockAudit = { logActivity: vi.fn(), logAudit: vi.fn() };

describe('TicketComplianceService.closePriorSessionWaitingTickets', () => {
  let service: TicketComplianceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.branch.findMany.mockResolvedValue([{ id: 'branch-1', orgId: 'org-1' }]);
    mockPrisma.withBypassRls.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma),
    );
    mockPrisma.withTenant.mockImplementation(
      async (_orgId: string, cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
    );
    mockRedis.get.mockResolvedValue(null);
    service = new TicketComplianceService(
      mockPrisma as never,
      mockAudit as never,
      mockRedis as never,
    );
  });

  it('dry-run counts prior-session waiting without updating', async () => {
    mockPrisma.ticket.count.mockResolvedValue(6);

    const result = await service.closePriorSessionWaitingTickets(
      { invalidateDerivedStats: vi.fn(), publishMany: vi.fn(), refreshVisitStatus: vi.fn() },
      { orgId: 'org-1', dryRun: true },
    );

    expect(result).toEqual({ closed: 6, dryRun: true });
    expect(mockPrisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('marks prior-session waiting as no-show and publishes queue events', async () => {
    mockPrisma.ticket.findMany.mockResolvedValue([
      { id: 'old-1', queueId: 'queue-1', visitId: 'visit-1' },
      { id: 'old-2', queueId: 'queue-1', visitId: null },
    ]);
    mockPrisma.ticket.updateMany.mockResolvedValue({ count: 2 });
    const publishMany = vi.fn().mockResolvedValue(undefined);
    const invalidateDerivedStats = vi.fn().mockResolvedValue(undefined);
    const refreshVisitStatus = vi.fn().mockResolvedValue(undefined);

    const result = await service.closePriorSessionWaitingTickets(
      { invalidateDerivedStats, publishMany, refreshVisitStatus },
      { orgId: 'org-1', branchId: 'branch-1' },
    );

    expect(result).toEqual({ closed: 2, dryRun: false });
    expect(mockPrisma.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'no_show' }),
      }),
    );
    expect(publishMany).toHaveBeenCalledWith([
      expect.objectContaining({ event: 'ticket.no_show' }),
      expect.objectContaining({ event: 'ticket.no_show' }),
    ]);
    expect(refreshVisitStatus).toHaveBeenCalledWith('org-1', 'visit-1');
    expect(invalidateDerivedStats).toHaveBeenCalledWith('org-1', 'branch-1', ['queue-1']);
  });
});
