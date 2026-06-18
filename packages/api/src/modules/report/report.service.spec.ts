import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportService } from './report.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  organization: {
    findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
  },
  branch: {
    findFirst: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
  },
  ticket: {
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  service: {
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  desk: {
    count: vi.fn(),
  },
  review: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  visit: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  getJson: vi.fn(),
  setJson: vi.fn(),
};

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(undefined);
    mockPrisma.desk.count.mockResolvedValue(0);
    mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { _all: 0 } });
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    service = new ReportService(mockPrisma as any, mockRedis as any);
  });

  describe('overview', () => {
    it('uses timestamp-derived wait and service minutes for averages', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.ticket.groupBy
        .mockResolvedValueOnce([
          { status: 'waiting', _count: { _all: 1 } },
          { status: 'called', _count: { _all: 2 } },
          { status: 'serving', _count: { _all: 1 } },
          { status: 'completed', _count: { _all: 2 } },
          { status: 'no_show', _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([
          { status: 'waiting', _count: { _all: 1 } },
          { status: 'called', _count: { _all: 2 } },
          { status: 'serving', _count: { _all: 1 } },
        ]);
      mockPrisma.ticket.findMany.mockResolvedValue([
        {
          bookedAt: new Date('2026-04-26T10:00:00.000Z'),
          servedAt: new Date('2026-04-26T10:00:18.000Z'),
          completedAt: new Date('2026-04-26T10:01:00.000Z'),
          waitMinutes: 0,
          serviceMinutes: 0,
        },
        {
          bookedAt: new Date('2026-04-26T10:05:00.000Z'),
          servedAt: new Date('2026-04-26T10:05:30.000Z'),
          completedAt: new Date('2026-04-26T10:06:00.000Z'),
          waitMinutes: 0,
          serviceMinutes: 0,
        },
      ]);

      const result = await service.overview('org-1');

      expect(result.avgWaitMinutes).toBe(0.4);
      expect(result.avgServiceMinutes).toBe(0.6);
      expect(result.called).toBe(2);
      expect(result.activeNow).toBe(3);
      expect(result.pendingNow).toBe(3);
      expect(result.completionRate).toBe(28.6);
      expect(result.noShowRate).toBe(14.3);
    });

    it('returns cached payload without hitting Prisma when Redis has a value', async () => {
      const cached = {
        totalToday: 1,
        waiting: 0,
        called: 0,
        serving: 0,
        completed: 1,
        noShow: 0,
        cancelled: 0,
        activeNow: 0,
        pendingNow: 0,
        completionRate: 100,
        noShowRate: 0,
        cancelledRate: 0,
        avgWaitMinutes: 0,
        avgServiceMinutes: 0,
      };
      mockRedis.getJson.mockResolvedValueOnce(cached);

      const result = await service.overview('org-1');

      expect(result).toEqual(cached);
      expect(mockPrisma.ticket.groupBy).not.toHaveBeenCalled();
    });

    it('uses live pipeline for called/serving even when no tickets were booked today in those states', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.ticket.groupBy
        .mockResolvedValueOnce([
          { status: 'waiting', _count: { _all: 3 } },
          { status: 'completed', _count: { _all: 10 } },
        ])
        .mockResolvedValueOnce([
          { status: 'waiting', _count: { _all: 1 } },
          { status: 'called', _count: { _all: 4 } },
          { status: 'serving', _count: { _all: 2 } },
        ]);
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      const result = await service.overview('org-1');

      expect(result.called).toBe(4);
      expect(result.serving).toBe(2);
      expect(result.waiting).toBe(1);
      expect(result.activeNow).toBe(6);
      expect(result.pendingNow).toBe(5);
      expect(result.totalToday).toBe(13);
      expect(result.completed).toBe(10);
    });

    it('rejects report ranges wider than the configured maximum', async () => {
      mockRedis.getJson.mockResolvedValue(null);

      await expect(service.servicePerformance('org-1', '2020-01-01', '2026-01-01')).rejects.toThrow(
        /Report range too large/,
      );
      expect(mockPrisma.ticket.findMany).not.toHaveBeenCalled();
    });

    it('passes org and branch filters to both groupBy queries', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.ticket.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.overview('org-1', 'branch-9');

      expect(mockPrisma.ticket.groupBy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({ orgId: 'org-1', branchId: 'branch-9' }),
        }),
      );
      expect(mockPrisma.ticket.groupBy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            branchId: 'branch-9',
            status: { in: ['waiting', 'called', 'serving'] },
          }),
        }),
      );
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        'report:overview:v5:org-1:today:UTC:branch-9',
        expect.any(Object),
        60,
      );
    });

    it('uses branch timezone in overview cache key when branchId is set', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'America/New_York' });
      mockPrisma.ticket.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.overview('org-1', 'branch-9');

      expect(mockPrisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'branch-9', orgId: 'org-1' },
        }),
      );
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        'report:overview:v5:org-1:today:America~New_York:branch-9',
        expect.objectContaining({ timezone: 'America/New_York' }),
        60,
      );
    });
  });

  describe('servicePerformance', () => {
    it('uses an inclusive date range and returns timestamp-derived wait and service averages', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([
        {
          serviceId: 'service-1',
          bookedAt: new Date('2026-04-25T10:00:00.000Z'),
          servedAt: new Date('2026-04-25T10:00:12.000Z'),
          completedAt: new Date('2026-04-25T10:00:42.000Z'),
          waitMinutes: 0,
          serviceMinutes: 0,
        },
        {
          serviceId: 'service-1',
          bookedAt: new Date('2026-04-26T11:00:00.000Z'),
          servedAt: new Date('2026-04-26T11:00:24.000Z'),
          completedAt: new Date('2026-04-26T11:00:48.000Z'),
          waitMinutes: 0,
          serviceMinutes: 0,
        },
      ]);
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'service-1', name: 'General' }]);

      const result = await service.servicePerformance('org-1', '2026-04-25', '2026-04-26');

      expect(result).toEqual([
        {
          serviceId: 'service-1',
          serviceName: 'General',
          ticketCount: 2,
          avgWaitMinutes: 0.3,
          avgServiceMinutes: 0.5,
        },
      ]);
      const findManyArgs = mockPrisma.ticket.findMany.mock.calls[0][0];
      expect(findManyArgs).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: 'org-1' }),
        }),
      );
      expect(findManyArgs.where.bookedAt.gte).toBeInstanceOf(Date);
      expect(findManyArgs.where.bookedAt.lt).toBeInstanceOf(Date);
      expect(findManyArgs.where.bookedAt.gte.getUTCFullYear()).toBe(2026);
      expect(findManyArgs.where.bookedAt.gte.getUTCMonth()).toBe(3);
      expect(findManyArgs.where.bookedAt.gte.getUTCDate()).toBe(25);
      expect(findManyArgs.where.bookedAt.gte.getUTCHours()).toBe(0);
      expect(findManyArgs.where.bookedAt.gte.getUTCMinutes()).toBe(0);
      expect(findManyArgs.where.bookedAt.lt.getUTCFullYear()).toBe(2026);
      expect(findManyArgs.where.bookedAt.lt.getUTCMonth()).toBe(3);
      expect(findManyArgs.where.bookedAt.lt.getUTCDate()).toBe(27);
      expect(findManyArgs.where.bookedAt.lt.getUTCHours()).toBe(0);
      expect(findManyArgs.where.bookedAt.lt.getUTCMinutes()).toBe(0);
      expect(findManyArgs.where.bookedAt.lt.getUTCSeconds()).toBe(0);
    });

    it('counts completed service tickets even when legacy timing metrics are missing', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([
        {
          serviceId: 'service-1',
          bookedAt: new Date('2026-04-25T10:00:00.000Z'),
          servedAt: new Date('2026-04-25T10:00:12.000Z'),
          completedAt: new Date('2026-04-25T10:00:42.000Z'),
          waitMinutes: 0,
          serviceMinutes: 0,
        },
        {
          serviceId: 'service-1',
          bookedAt: new Date('2026-04-25T11:00:00.000Z'),
          servedAt: null,
          completedAt: null,
          waitMinutes: null,
          serviceMinutes: null,
        },
      ]);
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'service-1', name: 'General' }]);

      const result = await service.servicePerformance('org-1', '2026-04-25', '2026-04-26');

      expect(result).toEqual([
        {
          serviceId: 'service-1',
          serviceName: 'General',
          ticketCount: 2,
          avgWaitMinutes: 0.2,
          avgServiceMinutes: 0.5,
        },
      ]);
    });
  });

  describe('staffPerformance', () => {
    it('returns average service minutes for staff rows', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([
        {
          servedByUserId: 'user-1',
          bookedAt: new Date('2026-04-25T10:00:00.000Z'),
          servedAt: new Date('2026-04-25T10:00:12.000Z'),
          completedAt: new Date('2026-04-25T10:00:42.000Z'),
          waitMinutes: 0,
          serviceMinutes: 0,
        },
        {
          servedByUserId: 'user-1',
          bookedAt: new Date('2026-04-25T11:00:00.000Z'),
          servedAt: new Date('2026-04-25T11:00:30.000Z'),
          completedAt: new Date('2026-04-25T11:01:06.000Z'),
          waitMinutes: 0,
          serviceMinutes: 0,
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'Ava', lastName: 'Smith' },
      ]);

      const result = await service.staffPerformance('org-1', '2026-04-25', '2026-04-26');

      expect(result).toEqual([
        {
          userId: 'user-1',
          userName: 'Ava Smith',
          ticketsServed: 2,
          avgServiceMinutes: 0.6,
          avgWaitMinutes: 0.4,
          satisfactionRate: null,
        },
      ]);
    });

    it('counts completed staff tickets even when legacy timing metrics are missing', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([
        {
          servedByUserId: 'user-1',
          bookedAt: new Date('2026-04-25T10:00:00.000Z'),
          servedAt: new Date('2026-04-25T10:00:12.000Z'),
          completedAt: new Date('2026-04-25T10:00:42.000Z'),
          waitMinutes: 0,
          serviceMinutes: 0,
        },
        {
          servedByUserId: 'user-1',
          bookedAt: new Date('2026-04-25T11:00:00.000Z'),
          servedAt: null,
          completedAt: null,
          waitMinutes: null,
          serviceMinutes: null,
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'Ava', lastName: 'Smith' },
      ]);

      const result = await service.staffPerformance('org-1', '2026-04-25', '2026-04-26');

      expect(result).toEqual([
        {
          userId: 'user-1',
          userName: 'Ava Smith',
          ticketsServed: 2,
          avgServiceMinutes: 0.5,
          avgWaitMinutes: 0.2,
          satisfactionRate: null,
        },
      ]);
    });
  });

  describe('dailySummary', () => {
    it('uses actual completed ticket wait and service times', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          day: new Date('2026-04-26T00:00:00.000Z'),
          total: 3,
          completed: 2,
          noShow: 1,
          avgWait: 5,
          avgService: 10,
        },
      ]);

      const result = await service.dailySummary('org-1', '2026-04-26', '2026-04-26');

      expect(result).toEqual([
        {
          date: '2026-04-26',
          total: 3,
          completed: 2,
          noShow: 1,
          avgWaitMinutes: 5,
          avgServiceMinutes: 10,
        },
      ]);
    });
  });

  describe('visitJourney', () => {
    it('aggregates visit-level and phase-level metrics', async () => {
      mockRedis.getJson.mockResolvedValue(null);
      mockPrisma.visit.findMany.mockResolvedValue([
        {
          id: 'v1',
          status: 'completed',
          startedAt: new Date('2026-04-26T10:00:00.000Z'),
          completedAt: new Date('2026-04-26T10:30:00.000Z'),
          tickets: [
            {
              id: 't1',
              status: 'completed',
              bookedAt: new Date('2026-04-26T10:00:00.000Z'),
              calledAt: new Date('2026-04-26T10:05:00.000Z'),
              servedAt: new Date('2026-04-26T10:06:00.000Z'),
              completedAt: new Date('2026-04-26T10:08:00.000Z'),
            },
            {
              id: 't2',
              status: 'completed',
              bookedAt: new Date('2026-04-26T10:20:00.000Z'),
              calledAt: new Date('2026-04-26T10:23:00.000Z'),
              servedAt: new Date('2026-04-26T10:24:00.000Z'),
              completedAt: new Date('2026-04-26T10:30:00.000Z'),
            },
          ],
        },
        {
          id: 'v2',
          status: 'active',
          startedAt: new Date('2026-04-26T11:00:00.000Z'),
          completedAt: null,
          tickets: [
            {
              id: 't3',
              status: 'completed',
              bookedAt: new Date('2026-04-26T11:00:00.000Z'),
              calledAt: new Date('2026-04-26T11:04:00.000Z'),
              servedAt: new Date('2026-04-26T11:05:00.000Z'),
              completedAt: new Date('2026-04-26T11:07:00.000Z'),
            },
          ],
        },
      ]);

      const result = await service.visitJourney('org-1', '2026-04-26', '2026-04-26');

      expect(result.totalVisits).toBe(2);
      expect(result.completedVisits).toBe(1);
      expect(result.multiStepVisits).toBe(1);
      expect(result.dropOffAfterFirstStep).toBe(1);
      expect(result.avgTotalVisitMinutes).toBe(30);
      expect(result.avgCounterWaitMinutes).toBe(5.5);
      expect(result.avgPrepWaitMinutes).toBe(12);
      expect(result.avgPickupWaitMinutes).toBe(4);
    });
  });
});
