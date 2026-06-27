import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketService } from './ticket.service';
import { TicketStaffGuardService } from './ticket-staff-guard.service';

import { mockRequestContext } from '../../test/mock-request-context';

const mockPrisma = {
  ticket: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  role: { findFirst: vi.fn() },
  roleAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
  desk: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  queue: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  customer: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  branch: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  branchDateOverride: { findUnique: vi.fn() },
  workingHours: { findUnique: vi.fn() },
  organization: {
    findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC', visitJourneysEnabled: false }),
  },
  branchService: { findUnique: vi.fn() },
  service: { findUnique: vi.fn() },
  visit: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  subService: { findFirst: vi.fn() },
  branchFlowTemplate: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  branchFlowStep: { findFirst: vi.fn(), findMany: vi.fn() },
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

const mockConfig = {
  get: vi.fn(),
};

const mockNotifications = {
  notifyTicketCalled: vi.fn().mockResolvedValue(undefined),
  notifyTicketIssued: vi.fn().mockResolvedValue(undefined),
  notifyTicketAlmostReady: vi.fn().mockResolvedValue(undefined),
  notifyTicketRecalled: vi.fn().mockResolvedValue(undefined),
};

const mockAudit = {
  logActivity: vi.fn(),
  logAudit: vi.fn(),
};

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

const mockWorkflow = {
  getNextStep: vi.fn(),
};

const mockBranchHours = {
  assertBranchAcceptsCustomerIntake: vi.fn().mockResolvedValue(undefined),
};

const ticketLockDefaults = {
  queueId: 'queue-1',
  branchId: 'branch-1',
  orgId: 'org-1',
  bookedAt: new Date('2026-04-26T10:00:00.000Z'),
  servedAt: null as Date | null,
  calledAt: null as Date | null,
};

/** Matches `transitionTicketCore` FOR UPDATE row shape (queue/branch must align with queue mock). */
function mockTicketLock(status: string, overrides: Partial<typeof ticketLockDefaults> = {}) {
  mockPrisma.$queryRaw.mockResolvedValueOnce([{ status, ...ticketLockDefaults, ...overrides }]);
}

describe('TicketService', () => {
  let service: TicketService;
  let staffGuards: TicketStaffGuardService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRaw.mockReset();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.desk.count.mockResolvedValue(1);
    mockPrisma.desk.findMany.mockResolvedValue([{ number: '1' }]);
    mockPrisma.desk.findUnique.mockResolvedValue({ status: 'open' });
    mockPrisma.queue.findUnique.mockResolvedValue({
      id: 'queue-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      serviceId: 'service-1',
      status: 'open',
      callingPolicy: 'fifo',
      stepRole: 'service',
      flowTemplateId: null,
    });
    mockPrisma.queue.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue(null);
    mockPrisma.branchFlowStep.findFirst.mockResolvedValue(null);
    mockPrisma.branchFlowStep.findMany.mockResolvedValue([]);
    mockPrisma.queue.update.mockResolvedValue({});
    mockPrisma.queue.count.mockResolvedValue(0);
    mockPrisma.branch.findUnique.mockResolvedValue({
      orgId: 'org-1',
      defaultJourneyMode: 'single_ticket',
      timezone: 'UTC',
    });
    mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'UTC' });
    mockPrisma.branchDateOverride.findUnique.mockResolvedValue(null);
    mockPrisma.workingHours.findUnique.mockResolvedValue({
      openTime: '00:00',
      closeTime: '23:59',
      isClosed: false,
      breakStart: null,
      breakEnd: null,
    });
    mockPrisma.service.findUnique.mockResolvedValue({ orgId: 'org-1', journeyModeOverride: null });
    mockPrisma.branchService.findUnique.mockResolvedValue({ journeyModeOverride: null });
    mockPrisma.visit.findFirst.mockResolvedValue({
      id: 'visit-1',
      status: 'active',
      branchId: 'branch-1',
      customerName: 'Anonymous',
      customerPhone: null,
      language: 'en',
    });
    mockPrisma.visit.findUnique.mockResolvedValue({ id: 'visit-1', externalRef: null });
    mockPrisma.visit.create.mockResolvedValue({ id: 'visit-created-1' });
    mockPrisma.visit.update.mockResolvedValue({});
    mockPrisma.ticket.findMany.mockResolvedValue([]);
    mockPrisma.ticket.findFirst.mockResolvedValue(null);
    mockPrisma.ticket.create.mockResolvedValue({
      id: 'ticket-issue-1',
      displayNumber: 'A001',
      customerPhone: null,
      queue: { id: 'queue-1', name: 'Main Queue' },
      service: { id: 'service-1', name: 'Main Service' },
    });
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.customer.findUnique.mockResolvedValue(null);
    mockPrisma.customer.create.mockResolvedValue({ id: 'customer-1' });
    mockPrisma.customer.update.mockResolvedValue({});
    mockPrisma.roleAssignment.findMany.mockResolvedValue([]);
    mockRedis.getJson.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.withTenant.mockImplementation(
      async (_orgId: string, cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
        cb(mockPrisma as never),
    );
    mockPrisma.withBypassRls.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma as never),
    );
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma as never),
    );
    mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'TICKET_ALMOST_READY_POSITION') return defaultValue ?? '3';
      return defaultValue as never;
    });
    staffGuards = new TicketStaffGuardService(mockPrisma as any, mockBranchHours as any);
    service = new TicketService(
      mockPrisma as any,
      mockRedis as any,
      mockConfig as any,
      mockNotifications as any,
      mockAudit as any,
      mockPlanLimits as any,
      mockWorkflow as any,
      mockRequestContext as any,
      staffGuards as any,
    );
  });

  describe('getTicketPublic', () => {
    const baseWaiting = (): Record<string, unknown> => ({
      id: 'ticket-1',
      orgId: 'org-1',
      displayNumber: 'Q001',
      status: 'waiting',
      deskNumber: null,
      bookedAt: new Date('2026-04-26T10:00:00.000Z'),
      calledAt: null,
      servedAt: null,
      completedAt: null,
      waitMinutes: null,
      serviceMinutes: null,
      customerPhone: '+15559876543',
      queueId: 'queue-1',
      branchId: 'branch-1',
      serviceId: 'service-1',
      priority: 0,
      estimatedRemainingMins: null,
      queue: { id: 'queue-1', name: 'Ordering' },
      branch: {
        id: 'branch-1',
        name: 'Main Branch',
        exceptionalCustomerNotice: false,
        exceptionalCustomerNoticeMinutes: null,
      },
      service: {
        id: 'service-1',
        name: 'Ordering',
        durationMinutes: 10,
        serviceEstimateLowMinutes: 5,
        serviceEstimateHighMinutes: 10,
        instructionalTip: null,
      },
    });

    function mockPublicTicketFindUnique(fullTicket: Record<string, unknown>) {
      mockPrisma.ticket.findUnique.mockImplementation(
        (args: { select?: Record<string, unknown> }) => {
          const select = args?.select ?? {};
          if (select.orgId === true && Object.keys(select).length === 1) {
            return Promise.resolve({ orgId: fullTicket.orgId ?? 'org-1' });
          }
          return Promise.resolve(fullTicket);
        },
      );
    }

    // Sequence the three Promise.all sources in `getTicketPublic`:
    // 1) cache:q-waiting-ids → string[]   (sorted: priority desc, bookedAt asc)
    // 2) cache:b-desks       → { number }[]  (open desks)
    // 3) cache:bs-cfg        → branchService row | null
    function primeCacheReads(opts: {
      waitingIds: string[];
      openDesks?: Array<{ number: string }>;
      branchService?: {
        customServiceEstimateLowMinutes: number | null;
        customServiceEstimateHighMinutes: number | null;
      } | null;
    }) {
      mockRedis.getJson
        .mockResolvedValueOnce(null as never) // cache:ticket-public miss → Prisma load
        .mockResolvedValueOnce(opts.waitingIds as never)
        .mockResolvedValueOnce((opts.openDesks ?? [{ number: '1' }]) as never)
        .mockResolvedValueOnce((opts.branchService ?? null) as never);
    }

    it('includes service instructional tip on public track payload', async () => {
      mockPublicTicketFindUnique({
        ...baseWaiting(),
        service: {
          ...(baseWaiting().service as object),
          instructionalTip: 'Keep your passport ready',
        },
      });
      primeCacheReads({ waitingIds: ['ticket-1'] });

      const result = await service.getTicketPublic('ticket-1');

      expect(result.service?.instructionalTip).toBe('Keep your passport ready');
    });

    it('returns zero estimated wait when first in line', async () => {
      mockPublicTicketFindUnique(baseWaiting());
      primeCacheReads({ waitingIds: ['ticket-1', 't-2', 't-3'] });

      const result = await service.getTicketPublic('ticket-1');

      expect(result.position).toBe(1);
      expect(result.waitingTotal).toBe(3);
      expect(result.estimatedWaitMins).toBe(0);
      expect(result.estimatedWaitMax).toBe(0);
      expect(result.customerPhoneMasked).toBe('*******6543');
    });

    it('scales by people ahead and open desks (low/high per turn)', async () => {
      mockPublicTicketFindUnique(baseWaiting());
      // ticket-1 is 3rd in line → 2 people ahead
      primeCacheReads({ waitingIds: ['t-a', 't-b', 'ticket-1', 't-d', 't-e'] });

      const result = await service.getTicketPublic('ticket-1');

      expect(result.position).toBe(3);
      expect(result.waitingTotal).toBe(5);
      // ceil(2/1)=2 rounds → 2*5=10, 2*10=20
      expect(result.estimatedWaitMins).toBe(10);
      expect(result.estimatedWaitMax).toBe(20);
    });

    it('uses higher desk capacity to reduce rounds', async () => {
      mockPublicTicketFindUnique(baseWaiting());
      // ticket-1 is 5th in line → 4 people ahead, 2 open desks
      primeCacheReads({
        waitingIds: ['a', 'b', 'c', 'd', 'ticket-1', 'f'],
        openDesks: [{ number: '1' }, { number: '2' }],
      });

      const result = await service.getTicketPublic('ticket-1');

      expect(result.position).toBe(5);
      // ceil(4/2)=2 → 10, 20
      expect(result.estimatedWaitMins).toBe(10);
      expect(result.estimatedWaitMax).toBe(20);
    });

    it('prefers branch service estimate overrides', async () => {
      mockPublicTicketFindUnique(baseWaiting());
      primeCacheReads({
        waitingIds: ['a', 'ticket-1'],
        branchService: {
          customServiceEstimateLowMinutes: 8,
          customServiceEstimateHighMinutes: 12,
        },
      });

      const result = await service.getTicketPublic('ticket-1');

      expect(result.estimatedWaitMins).toBe(8);
      expect(result.estimatedWaitMax).toBe(12);
    });

    it('returns no band when service estimates are missing', async () => {
      const row = baseWaiting();
      row.service = {
        id: 'service-1',
        name: 'Ordering',
        durationMinutes: null,
        serviceEstimateLowMinutes: null,
        serviceEstimateHighMinutes: null,
      };
      mockPublicTicketFindUnique(row);
      primeCacheReads({ waitingIds: ['ticket-1'] });

      const result = await service.getTicketPublic('ticket-1');

      expect(result.estimatedWaitMins).toBeUndefined();
      expect(result.estimatedWaitMax).toBeUndefined();
    });

    it('sets exceptional banner from branch flag and passes optional minutes', async () => {
      const row = baseWaiting();
      row.branch = {
        id: 'branch-1',
        name: 'Main Branch',
        exceptionalCustomerNotice: true,
        exceptionalCustomerNoticeMinutes: 15,
      };
      mockPublicTicketFindUnique(row);
      primeCacheReads({ waitingIds: ['ticket-1'] });

      const result = await service.getTicketPublic('ticket-1');

      expect(result.isExceptionalInProgress).toBe(true);
      expect(result.exceptionalCustomerNoticeMinutes).toBe(15);
    });

    it('hits Redis cache on warm reads — zero DB round-trips for waiting/desks/branch-service', async () => {
      mockPublicTicketFindUnique(baseWaiting());
      primeCacheReads({
        waitingIds: ['ticket-1', 't-2'],
        openDesks: [{ number: '1' }],
        branchService: { customServiceEstimateLowMinutes: 5, customServiceEstimateHighMinutes: 10 },
      });

      await service.getTicketPublic('ticket-1');

      // The three derived datasets are served from Redis — DB is not touched for them.
      expect(mockPrisma.ticket.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.desk.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.branchService.findUnique).not.toHaveBeenCalled();
      // Ticket-public row is written once after the Prisma load; derived keys stay warm in Redis.
      expect(mockRedis.setJson).toHaveBeenCalledTimes(1);
      expect(mockRedis.setJson.mock.calls[0][0]).toBe('cache:ticket-public:ticket-1');
    });

    it('cold cache: hydrates Redis with sorted waiting ids, open desks, and branch-service config', async () => {
      mockPublicTicketFindUnique(baseWaiting());
      // All caches miss: ticket-public, then q-waiting-ids, b-desks, bs-cfg
      mockRedis.getJson
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never);

      mockPrisma.ticket.findMany.mockResolvedValueOnce([
        { id: 'ticket-1' },
        { id: 't-2' },
      ] as never);
      mockPrisma.desk.findMany.mockResolvedValueOnce([{ number: '1' }] as never);
      mockPrisma.branchService.findUnique.mockResolvedValueOnce(null as never);

      const result = await service.getTicketPublic('ticket-1');

      expect(result.position).toBe(1);
      expect(result.waitingTotal).toBe(2);

      // Each miss writes back a TTL'd entry
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        'cache:q-waiting-ids:v2:queue-1:UTC',
        ['ticket-1', 't-2'],
        60,
      );
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        'cache:b-desks:branch-1',
        [{ number: '1' }],
        60,
      );
      expect(mockRedis.setJson).toHaveBeenCalledWith('cache:bs-cfg:branch-1:service-1', null, 3600);

      // The waiting-ids fetch must follow persisted waiting order then FIFO fallback.
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          queueId: 'queue-1',
          status: 'waiting',
          bookedAt: { gte: expect.any(Date) },
        },
        orderBy: [{ position: { sort: 'asc', nulls: 'last' } }, { bookedAt: 'asc' }],
        select: { id: true },
      });
    });

    it('excludes prior-session waiting tickets from position and waitingTotal', async () => {
      mockPublicTicketFindUnique(baseWaiting());
      mockRedis.getJson
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never);

      mockPrisma.ticket.findMany.mockResolvedValueOnce([{ id: 'ticket-1' }] as never);
      mockPrisma.desk.findMany.mockResolvedValueOnce([{ number: '1' }] as never);
      mockPrisma.branchService.findUnique.mockResolvedValueOnce(null as never);

      const result = await service.getTicketPublic('ticket-1');

      expect(result.position).toBe(1);
      expect(result.waitingTotal).toBe(1);
      expect(result.estimatedWaitMins).toBe(0);
      expect(result.estimatedWaitMax).toBe(0);
    });
  });

  describe('getVisitPublic', () => {
    function mockPublicVisitFindFirst(fullVisit: Record<string, unknown>) {
      mockPrisma.visit.findFirst.mockImplementation(
        (args: { select?: Record<string, unknown> }) => {
          const select = args?.select ?? {};
          if (select.orgId === true && Object.keys(select).length === 1) {
            return Promise.resolve({ orgId: 'org-1' });
          }
          return Promise.resolve(fullVisit);
        },
      );
    }

    it('maps active final waiting step to pickup queue', async () => {
      mockPublicVisitFindFirst({
        id: 'visit-1',
        trackingToken: 'track-1',
        status: 'active',
        source: 'kiosk',
        startedAt: new Date(),
        completedAt: null,
        customerName: 'A',
        branch: { id: 'branch-1', name: 'Main' },
        tickets: [
          {
            id: 't1',
            displayNumber: 'A001',
            status: 'completed',
            stepIndex: 1,
            queueId: 'q1',
            queue: { id: 'q1', name: 'Order' },
            service: { id: 's1', name: 'Order' },
            deskNumber: '1',
            externalRef: 'R-100',
            bookedAt: new Date(),
            readyAt: null,
            calledAt: new Date(),
            servedAt: new Date(),
            completedAt: new Date(),
          },
          {
            id: 't2',
            displayNumber: 'A002',
            status: 'waiting',
            stepIndex: 2,
            queueId: 'q2',
            queue: { id: 'q2', name: 'Pickup' },
            service: { id: 's2', name: 'Pickup' },
            deskNumber: null,
            externalRef: 'R-100',
            bookedAt: new Date(),
            readyAt: null,
            calledAt: null,
            servedAt: null,
            completedAt: null,
          },
        ],
      });

      const result = await service.getVisitPublic('visit-1');
      expect(result.currentStep).toBe('pickup_queue');
      expect(result.activeTicket?.externalRef).toBe('R-100');
    });

    it('keeps preparing_pickup for non-final waiting step', async () => {
      mockPublicVisitFindFirst({
        id: 'visit-2',
        trackingToken: 'track-2',
        status: 'active',
        source: 'kiosk',
        startedAt: new Date(),
        completedAt: null,
        customerName: 'B',
        branch: { id: 'branch-1', name: 'Main' },
        tickets: [
          {
            id: 't3',
            displayNumber: 'B001',
            status: 'waiting',
            stepIndex: 1,
            queueId: 'q1',
            queue: { id: 'q1', name: 'Order' },
            service: { id: 's1', name: 'Order' },
            deskNumber: null,
            externalRef: null,
            bookedAt: new Date(),
            readyAt: null,
            calledAt: null,
            servedAt: null,
            completedAt: null,
          },
          {
            id: 't4',
            displayNumber: 'B002',
            status: 'waiting',
            stepIndex: 2,
            queueId: 'q2',
            queue: { id: 'q2', name: 'Pickup' },
            service: { id: 's2', name: 'Pickup' },
            deskNumber: null,
            externalRef: null,
            bookedAt: new Date(),
            readyAt: null,
            calledAt: null,
            servedAt: null,
            completedAt: null,
          },
        ],
      });

      const result = await service.getVisitPublic('visit-2');
      expect(result.currentStep).toBe('preparing_pickup');
    });

    it('includes service metadata instructionalTip and icon', async () => {
      mockPublicVisitFindFirst({
        id: 'visit-3',
        trackingToken: 'track-3',
        status: 'active',
        source: 'kiosk',
        startedAt: new Date(),
        completedAt: null,
        customerName: 'C',
        branch: { id: 'branch-1', name: 'Main' },
        tickets: [
          {
            id: 't5',
            displayNumber: 'C001',
            status: 'waiting',
            stepIndex: 1,
            queueId: 'q1',
            queue: { id: 'q1', name: 'Order' },
            service: { id: 's1', name: 'Order', instructionalTip: 'Go to station A', icon: 'star' },
            deskNumber: null,
            externalRef: null,
            bookedAt: new Date(),
            readyAt: null,
            calledAt: null,
            servedAt: null,
            completedAt: null,
          },
        ],
      });

      const result = await service.getVisitPublic('visit-3');
      expect(result.activeTicket?.service.instructionalTip).toBe('Go to station A');
      expect(result.activeTicket?.service.icon).toBe('star');
    });
  });

  describe('Centrifugo publishMany batching', () => {
    // Regression test for the previous "publishEvent fires N HTTP calls per ticket action" issue.
    // All real-time events for a single action MUST collapse into ONE batched POST to /api/batch.
    it('callNext fires exactly one batched Centrifugo POST containing every channel publish', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      mockConfig.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'app.centrifugo.apiUrl') return 'http://centrifugo.local/api';
        if (key === 'app.centrifugo.apiKey') return 'test-key';
        if (key === 'TICKET_ALMOST_READY_POSITION') return defaultValue ?? '3';
        return undefined as unknown as string;
      });

      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-batch' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-batch',
        displayNumber: 'X1',
        branchId: 'branch-1',
        queueId: 'queue-1',
        customerPhone: null,
        queue: { id: 'queue-1', name: 'Main' },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.callNext('org-1', 'queue-1', '1', 'user-1');

      // Wait for the fire-and-forget publish to settle.
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

      expect(mockRedis.publishTrackQueues).toHaveBeenCalledWith(['queue-1']);

      // Exactly ONE HTTP call — not 3 (queue, display, org) and not 4 (with queue.updated companion).
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://centrifugo.local/api/batch');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('apikey test-key');

      const body = JSON.parse(init.body as string);
      // Centrifugo /api/batch shape: { commands: [{ publish: {channel, data} }, ...], parallel: true }
      expect(body).toHaveProperty('commands');
      expect(body).toHaveProperty('parallel', true);
      expect(Array.isArray(body.commands)).toBe(true);

      const channels = body.commands.map((c: any) => c.publish.channel);
      // 3 explicit channels + 1 implicit `queue.updated` companion on the queue: channel = 4 publishes
      expect(channels).toEqual(['queue:queue-1', 'queue:queue-1', 'display:branch-1', 'org:org-1']);

      // The queue.updated companion shape we rely on for blanket subscribers
      const queueUpdated = body.commands.find(
        (c: any) =>
          c.publish.channel === 'queue:queue-1' && c.publish.data?.event === 'queue.updated',
      );
      expect(queueUpdated).toBeDefined();
      expect(queueUpdated.publish.data.data).toEqual({ sourceEvent: 'ticket.called' });

      vi.unstubAllGlobals();
    });

    it('notifies visit track SSE via Redis when ticket has visitId', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-visit' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-visit',
        displayNumber: 'V1',
        branchId: 'branch-1',
        queueId: 'queue-1',
        orgId: 'org-1',
        visitId: 'visit-1',
        customerPhone: null,
        queue: { id: 'queue-1', name: 'Main' },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.callNext('org-1', 'queue-1', '1', 'user-1');

      await vi.waitFor(() =>
        expect(mockRedis.publishTrackVisits).toHaveBeenCalledWith(['visit-1']),
      );
      vi.unstubAllGlobals();
    });

    it('still notifies track SSE via Redis when Centrifugo env is not configured', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      // mockConfig.get returns undefined for both apiUrl/apiKey by default in beforeEach

      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-noop' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-noop',
        displayNumber: 'Q1',
        branchId: 'branch-1',
        queueId: 'queue-1',
        customerPhone: null,
        queue: { id: 'queue-1', name: 'Main' },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.callNext('org-1', 'queue-1', '1', 'user-1');

      await vi.waitFor(() =>
        expect(mockRedis.publishTrackQueues).toHaveBeenCalledWith(['queue-1']),
      );

      // Give the microtask queue a chance to schedule any stray fetch.
      await new Promise((r) => setTimeout(r, 10));
      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe('callNext', () => {
    it('rejects classic callNext when staff has no desk assignments in branch', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'open',
        callingPolicy: 'fifo',
        stepRole: 'service',
        flowTemplateId: null,
      });
      mockPrisma.desk.findMany.mockResolvedValueOnce([]);

      await expect(service.callNext('org-1', 'queue-1', '1', 'user-1')).rejects.toThrow(
        /do not have any desk assignments in this branch/i,
      );
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects callNext when queue policy is manual-only', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'open',
        callingPolicy: 'manual_only',
        stepRole: 'service',
        flowTemplateId: null,
      });

      await expect(service.callNext('org-1', 'queue-1', '1', 'user-1')).rejects.toThrow(
        'manual call',
      );
    });

    it('allows callNext when queue is paused (serve existing waiting customers)', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'paused',
        callingPolicy: 'fifo',
        stepRole: 'service',
        flowTemplateId: null,
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-paused' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-paused',
        displayNumber: 'A001',
        branchId: 'branch-1',
        queueId: 'queue-1',
        customerPhone: null,
        queue: { name: 'Main' },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await expect(service.callNext('org-1', 'queue-1', '1', 'user-1')).resolves.toBeDefined();
      expect(mockPrisma.ticket.update).toHaveBeenCalled();
    });

    it('rejects callNext when queue is closed', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'closed',
        callingPolicy: 'fifo',
        stepRole: 'service',
        flowTemplateId: null,
      });

      await expect(service.callNext('org-1', 'queue-1', '1', 'user-1')).rejects.toThrow(
        /Queue is closed/i,
      );
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('orders callNext by persisted waiting position then bookedAt', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-order' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-order',
        displayNumber: 'A001',
        branchId: 'branch-1',
        queueId: 'queue-1',
        customerPhone: null,
        queue: { name: 'Main' },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.callNext('org-1', 'queue-1', '1', 'user-1');

      const queryArg = mockPrisma.$queryRaw.mock.calls[0]?.[0] as
        | { strings?: string[] }
        | undefined;
      const renderedSql = Array.isArray(queryArg?.strings)
        ? queryArg!.strings.join(' ')
        : String(queryArg);

      expect(renderedSql).toContain('position IS NULL');
      expect(renderedSql).toContain('position ASC');
      expect(renderedSql).toContain('booked_at ASC');
      expect(renderedSql).toContain('booked_at >=');
    });

    it('does not call waiting tickets from prior branch-local days', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.ticket.count.mockResolvedValue(0);

      await expect(service.callNext('org-1', 'queue-1', '1', 'user-1')).rejects.toThrow(
        'No waiting tickets',
      );

      const queryArg = mockPrisma.$queryRaw.mock.calls[0]?.[0] as
        | { strings?: string[] }
        | undefined;
      const renderedSql = Array.isArray(queryArg?.strings)
        ? queryArg!.strings.join(' ')
        : String(queryArg);
      expect(renderedSql).toContain('booked_at >=');
      expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
      expect(mockPrisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'branch-1', orgId: 'org-1' } }),
      );
    });

    it('uses branch timezone for callNext booked_at floor when branch differs from org', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-22T08:00:00.000Z'));

      mockPrisma.organization.findUnique.mockResolvedValue({
        timezone: 'UTC',
        visitJourneysEnabled: false,
      });
      mockPrisma.branch.findFirst.mockResolvedValue({ timezone: 'America/Los_Angeles' });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.ticket.count.mockResolvedValue(0);

      await expect(service.callNext('org-1', 'queue-1', '1', 'user-1')).rejects.toThrow(
        'No waiting tickets',
      );

      const sqlArg = mockPrisma.$queryRaw.mock.calls[0]?.[0] as { values?: unknown[] };
      const floorDate = sqlArg?.values?.find((value): value is Date => value instanceof Date);
      expect(floorDate?.toISOString()).toBe('2026-05-22T07:00:00.000Z');

      vi.useRealTimers();
    });

    it('explains when ready_then_fifo has waiting tickets but none marked ready', async () => {
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'open',
        callingPolicy: 'ready_then_fifo',
        stepRole: 'pickup',
        flowTemplateId: null,
      });
      mockPrisma.desk.findUnique.mockResolvedValue({ status: 'open' });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.ticket.count.mockResolvedValueOnce(6).mockResolvedValueOnce(0);

      await expect(service.callNext('org-1', 'queue-1', '1', 'user-1')).rejects.toThrow(
        'none are marked Ready',
      );
    });

    it('invokes notifyTicketCalled when the ticket has customerPhone', async () => {
      const orgId = 'org-1';
      const queueId = 'queue-1';

      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-1' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-1',
        displayNumber: 'A042',
        branchId: 'branch-1',
        queueId,
        customerPhone: '+15551234567',
        transactionalSmsAllowed: true,
        queue: { name: 'Main' },
      });
      mockNotifications.notifyTicketCalled.mockResolvedValue(undefined);
      mockPrisma.ticket.findMany.mockResolvedValue([]);
      mockPrisma.desk.findMany.mockResolvedValue([{ number: '3' }]);

      await service.callNext(orgId, queueId, '3', 'user-1');

      await vi.waitFor(() => {
        expect(mockNotifications.notifyTicketCalled).toHaveBeenCalledWith(
          orgId,
          'tid-1',
          expect.objectContaining({
            customerPhone: '+15551234567',
            displayNumber: 'A042',
            deskNumber: '3',
            queueName: 'Main',
          }),
        );
      });
    });

    it('does not SMS when ticket has no customerPhone', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-2' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-2',
        displayNumber: 'B01',
        branchId: 'branch-1',
        queueId: 'queue-1',
        customerPhone: null,
        queue: { name: 'Q' },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.callNext('org-1', 'queue-1', '1', 'user-1');

      await vi.waitFor(() => {
        expect(mockPrisma.ticket.update).toHaveBeenCalled();
      });
      expect(mockNotifications.notifyTicketCalled).not.toHaveBeenCalled();
    });

    it('caps almost-ready SMS to the first three waiting tickets (env above 3 is clamped)', async () => {
      mockConfig.get.mockImplementation((key: string, _defaultValue?: string) => {
        if (key === 'TICKET_ALMOST_READY_POSITION') return '99';
        return undefined as unknown as string;
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-call' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-call',
        displayNumber: 'Z9',
        branchId: 'branch-1',
        queueId: 'queue-1',
        customerPhone: '+19990000001',
        queue: { name: 'Main' },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([
        { id: 'w0', customerPhone: '+10000000000' },
        { id: 'w1', customerPhone: '+10000000001' },
        { id: 'w2', customerPhone: '+10000000002' },
      ]);

      await service.callNext('org-1', 'queue-1', '1', 'user-1');

      await vi.waitFor(() => {
        expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 3,
            where: expect.objectContaining({ queueId: 'queue-1', status: 'waiting' }),
          }),
        );
      });
      await vi.waitFor(() => {
        expect(mockNotifications.notifyTicketAlmostReady).toHaveBeenCalledTimes(3);
      });
    });

    it('uses env TICKET_ALMOST_READY_POSITION when it is below the hard cap', async () => {
      mockConfig.get.mockImplementation((key: string, _defaultValue?: string) => {
        if (key === 'TICKET_ALMOST_READY_POSITION') return '2';
        return undefined as unknown as string;
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'tid-x' }]);
      mockPrisma.ticket.update.mockResolvedValue({
        id: 'tid-x',
        displayNumber: 'X1',
        branchId: 'branch-1',
        queueId: 'queue-1',
        customerPhone: '+12220000001',
        queue: { name: 'Main' },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([
        { id: 'a', customerPhone: '+111' },
        { id: 'b', customerPhone: '+112' },
      ]);

      await service.callNext('org-1', 'queue-1', '1', 'user-1');

      await vi.waitFor(() => {
        expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 2 }),
        );
      });
      await vi.waitFor(() => {
        expect(mockNotifications.notifyTicketAlmostReady).toHaveBeenCalledTimes(2);
      });
    });

    it('does not resend almost-ready SMS for the same ticket on the next callNext when dedupe is active', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ id: 'c1' }])
        .mockResolvedValueOnce([{ id: 'c2' }]);
      mockPrisma.ticket.update
        .mockResolvedValueOnce({
          id: 'c1',
          displayNumber: 'A1',
          branchId: 'branch-1',
          queueId: 'queue-1',
          customerPhone: '+18880000001',
          queue: { name: 'Main' },
        })
        .mockResolvedValueOnce({
          id: 'c2',
          displayNumber: 'A2',
          branchId: 'branch-1',
          queueId: 'queue-1',
          customerPhone: '+18880000002',
          queue: { name: 'Main' },
        });
      mockPrisma.ticket.findMany.mockResolvedValue([
        { id: 'wait-1', customerPhone: '+17770000001' },
      ]);
      mockRedis.get.mockResolvedValue(null);

      await service.callNext('org-1', 'queue-1', '1', 'user-1');
      await vi.waitFor(() => {
        expect(mockNotifications.notifyTicketAlmostReady).toHaveBeenCalledTimes(1);
      });

      mockRedis.get.mockResolvedValue('sent');
      mockNotifications.notifyTicketAlmostReady.mockClear();

      await service.callNext('org-1', 'queue-1', '1', 'user-1');
      await vi.waitFor(() => {
        expect(mockPrisma.ticket.update).toHaveBeenCalledTimes(2);
      });
      expect(mockNotifications.notifyTicketAlmostReady).not.toHaveBeenCalled();
      mockRedis.get.mockResolvedValue(null);
    });
  });

  describe('manual call and readiness', () => {
    it('rejects callSpecific when staff is not assigned to the selected desk', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ queueId: 'queue-1' });
      mockPrisma.ticket.findUnique.mockImplementation(
        async (args: { select?: Record<string, boolean> }) => {
          if (args?.select?.visitId) {
            return { id: 't-1', visitId: null, stepIndex: null, queueId: 'queue-1' };
          }
          return {
            id: 't-1',
            queueId: 'queue-1',
            branchId: 'branch-1',
            status: 'waiting',
            readyAt: null,
            bookedAt: new Date(),
          };
        },
      );
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'open',
        callingPolicy: 'manual_only',
        stepRole: 'service',
        flowTemplateId: null,
      });
      mockPrisma.desk.findMany.mockResolvedValueOnce([{ number: '1' }]);

      await expect(service.callSpecific('org-1', 't-1', '2', 'user-1')).rejects.toThrow(
        /not assigned to Desk 2/i,
      );
    });

    it('rejects callSpecific when queue policy is call-next only (fifo)', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ queueId: 'queue-1' });
      mockPrisma.ticket.findUnique.mockImplementation(
        async (args: { select?: Record<string, boolean> }) => {
          if (args?.select?.visitId) {
            return { id: 't-1', visitId: null, stepIndex: null, queueId: 'queue-1' };
          }
          return {
            id: 't-1',
            queueId: 'queue-1',
            branchId: 'branch-1',
            status: 'waiting',
            readyAt: null,
            bookedAt: new Date(),
          };
        },
      );
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'open',
        callingPolicy: 'fifo',
        stepRole: 'service',
        flowTemplateId: 'tpl-journey',
        journeyModeOverride: 'visit_multi_step',
      });

      await expect(
        service.callSpecific('org-1', 't-1', '1', 'user-1', 'workbench'),
      ).rejects.toThrow(/Call Next only/i);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('blocks callSpecific until ticket is marked ready for ready-then-manual queues', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ queueId: 'queue-1' });
      mockPrisma.ticket.findUnique.mockImplementation(
        async (args: { select?: Record<string, boolean> }) => {
          if (args?.select?.visitId) {
            return { id: 't-1', visitId: null, stepIndex: null, queueId: 'queue-1' };
          }
          return {
            id: 't-1',
            queueId: 'queue-1',
            branchId: 'branch-1',
            status: 'waiting',
            readyAt: null,
            bookedAt: new Date(),
          };
        },
      );
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'open',
        callingPolicy: 'ready_then_manual',
        stepRole: 'pickup',
        flowTemplateId: null,
      });

      await expect(service.callSpecific('org-1', 't-1', '1', 'user-1')).rejects.toThrow(
        'marked ready',
      );
    });

    it('blocks callSpecific for waiting tickets from prior branch-local days', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ queueId: 'queue-1' });
      mockPrisma.ticket.findUnique.mockImplementation(
        async (args: { select?: Record<string, boolean> }) => {
          if (args?.select?.visitId) {
            return { id: 't-stale', visitId: null, stepIndex: null, queueId: 'queue-1' };
          }
          return {
            id: 't-stale',
            queueId: 'queue-1',
            branchId: 'branch-1',
            status: 'waiting',
            readyAt: null,
            bookedAt: new Date('2020-01-01T12:00:00Z'),
          };
        },
      );

      await expect(service.callSpecific('org-1', 't-stale', '1', 'user-1')).rejects.toThrow(
        'prior queue session',
      );
    });

    it('marks waiting tickets as ready and emits update events', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValueOnce({
        id: 't-ready',
        queueId: 'queue-1',
        status: 'waiting',
        readyAt: null,
        branchId: 'branch-1',
      });
      mockPrisma.queue.findUnique.mockResolvedValue({
        branchId: 'branch-1',
        status: 'open',
        callingPolicy: 'ready_then_manual',
        stepRole: 'pickup',
        flowTemplateId: null,
      });
      mockPrisma.ticket.update.mockResolvedValueOnce({
        id: 't-ready',
        queueId: 'queue-1',
        branchId: 'branch-1',
        displayNumber: 'A001',
        readyAt: new Date(),
        queue: { id: 'queue-1', name: 'Pickup' },
        service: { id: 'service-1', name: 'Pickup Service' },
      });

      const result = await service.markReady('org-1', 't-ready', 'user-1');

      expect(result.id).toBe('t-ready');
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't-ready' },
          data: expect.objectContaining({ readyAt: expect.any(Date) }),
        }),
      );
      expect(mockAudit.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ticket.mark_ready', resourceId: 't-ready' }),
      );
    });

    it('moves a waiting ticket to queue front without calling it', async () => {
      mockPrisma.ticket.findFirst
        .mockResolvedValueOnce({ queueId: 'queue-1' })
        .mockResolvedValueOnce({ position: -4 });
      mockPrisma.ticket.findUnique.mockResolvedValueOnce({
        id: 't-prio',
        queueId: 'queue-1',
        branchId: 'branch-1',
        status: 'waiting',
        position: null,
        bookedAt: new Date(),
      });
      mockPrisma.queue.findUnique.mockResolvedValueOnce({
        id: 'queue-1',
        branchId: 'branch-1',
        status: 'open',
      });
      mockPrisma.ticket.update.mockResolvedValueOnce({
        id: 't-prio',
        queueId: 'queue-1',
        branchId: 'branch-1',
        position: -5,
        queue: { id: 'queue-1', name: 'Main' },
        service: { id: 'service-1', name: 'Svc' },
      });

      const result = await service.bringToFirst('org-1', 't-prio', 'owner-1');

      expect(result.position).toBe(-5);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't-prio' },
          data: { position: -5 },
        }),
      );
      expect(mockPrisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 't-prio' },
          }),
        }),
      );
      expect(mockAudit.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ticket.bring_to_first', resourceId: 't-prio' }),
      );
    });
  });

  describe('issueTicket tenant and queue consistency', () => {
    const issuePayload = {
      queueId: 'queue-1',
      branchId: 'branch-1',
      serviceId: 'service-1',
      source: 'staff' as const,
    };

    beforeEach(() => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          prefix: 'A',
          status: 'open',
          nextTicketSeq: 1,
          sessionClosesAt: null,
        },
      ]);
      mockPrisma.withTenant.mockImplementation(
        async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
      );
    });

    it('rejects when branchId belongs to another organization', async () => {
      mockPrisma.branch.findUnique.mockResolvedValueOnce({ orgId: 'org-other' });

      await expect(
        service.issueTicket('org-1', issuePayload, 'authenticated'),
      ).rejects.toMatchObject({
        message: 'Branch not found',
      });
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });

    it('rejects when serviceId belongs to another organization', async () => {
      mockPrisma.service.findUnique.mockResolvedValueOnce({ orgId: 'org-other' });

      await expect(
        service.issueTicket('org-1', issuePayload, 'authenticated'),
      ).rejects.toMatchObject({
        message: 'Service not found',
      });
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });

    it('rejects when branchId does not match the queue', async () => {
      mockPrisma.queue.findUnique.mockResolvedValueOnce({
        id: 'queue-1',
        orgId: 'org-1',
        branchId: 'branch-other',
        serviceId: 'service-1',
        status: 'open',
      });

      await expect(
        service.issueTicket('org-1', issuePayload, 'authenticated'),
      ).rejects.toMatchObject({
        message: 'branchId and serviceId must match the selected queue',
      });
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });

    it('rejects when serviceId does not match the queue', async () => {
      mockPrisma.queue.findUnique.mockResolvedValueOnce({
        id: 'queue-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'service-other',
        status: 'open',
      });

      await expect(service.issueTicket('org-1', issuePayload, 'authenticated')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });
  });

  describe('issueTicket public flow entry', () => {
    it('blocks kiosk/public intake on a later-step queue in the active flow', async () => {
      mockPrisma.branchFlowTemplate.findMany.mockResolvedValue([
        {
          steps: [
            { stepIndex: 1, queueId: 'queue-entry' },
            { stepIndex: 2, queueId: 'queue-1' },
          ],
        },
      ]);

      await expect(
        service.issueTicket(
          'org-1',
          {
            queueId: 'queue-1',
            branchId: 'branch-1',
            serviceId: 'service-1',
            source: 'kiosk',
            customerPhone: '+15550001234',
          },
          'public',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows staff-authenticated intake on a later-step queue', async () => {
      mockPrisma.branchFlowTemplate.findMany.mockResolvedValue([
        {
          steps: [
            { stepIndex: 1, queueId: 'queue-entry' },
            { stepIndex: 2, queueId: 'queue-1' },
          ],
        },
      ]);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          prefix: 'A',
          status: 'open',
          nextTicketSeq: 1,
          sessionClosesAt: null,
        },
      ]);
      mockPrisma.withTenant.mockImplementation(
        async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
      );

      await expect(
        service.issueTicket(
          'org-1',
          {
            queueId: 'queue-1',
            branchId: 'branch-1',
            serviceId: 'service-1',
            source: 'staff',
          },
          'authenticated',
        ),
      ).resolves.toBeDefined();
    });

    it('rejects SMS opt-in without a valid phone number', async () => {
      await expect(
        service.issueTicket(
          'org-1',
          {
            queueId: 'queue-1',
            branchId: 'branch-1',
            serviceId: 'service-1',
            source: 'kiosk',
            transactionalSmsAllowed: true,
          },
          'public',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults ticket transactional SMS flag to false when not provided', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          prefix: 'A',
          status: 'open',
          nextTicketSeq: 1,
          sessionClosesAt: null,
        },
      ]);

      await service.issueTicket(
        'org-1',
        {
          queueId: 'queue-1',
          branchId: 'branch-1',
          serviceId: 'service-1',
          source: 'staff',
          customerPhone: '+15550001234',
          customerName: 'Alice',
        },
        'authenticated',
      );

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionalSmsAllowed: false,
          }),
        }),
      );
    });
  });

  describe('issueTicket session counter', () => {
    it('initializes session counter and starts from 001', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          prefix: 'K575',
          status: 'open',
          nextTicketSeq: 1,
          sessionClosesAt: null,
        },
      ]);

      const result = await service.issueTicket(
        'org-1',
        {
          queueId: 'queue-1',
          branchId: 'branch-1',
          serviceId: 'service-1',
          source: 'staff',
        },
        'authenticated',
      );

      expect(mockPrisma.queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'queue-1' },
          data: expect.objectContaining({
            nextTicketSeq: 2,
            sessionOpenedAt: expect.any(Date),
            sessionClosesAt: expect.any(Date),
          }),
        }),
      );
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayNumber: 'K575001' }),
        }),
      );
      expect(result.displayNumber).toBe('A001');
    });

    it('increments existing active session counter without reset', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          prefix: 'A',
          status: 'open',
          nextTicketSeq: 42,
          sessionClosesAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      ]);

      await service.issueTicket(
        'org-1',
        {
          queueId: 'queue-1',
          branchId: 'branch-1',
          serviceId: 'service-1',
          source: 'staff',
        },
        'authenticated',
      );

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayNumber: 'A042' }),
        }),
      );
      expect(mockPrisma.queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'queue-1' },
          data: { nextTicketSeq: { increment: 1 } },
        }),
      );
    });

    it('resets expired session counter back to 001', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          prefix: 'B',
          status: 'open',
          nextTicketSeq: 97,
          sessionClosesAt: new Date(Date.now() - 5 * 60 * 1000),
        },
      ]);

      await service.issueTicket(
        'org-1',
        {
          queueId: 'queue-1',
          branchId: 'branch-1',
          serviceId: 'service-1',
          source: 'staff',
        },
        'authenticated',
      );

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayNumber: 'B001' }),
        }),
      );
      expect(mockPrisma.queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'queue-1' },
          data: expect.objectContaining({
            nextTicketSeq: 2,
            sessionOpenedAt: expect.any(Date),
            sessionClosesAt: expect.any(Date),
          }),
        }),
      );
    });

    it('creates a visit and links ticket when visit mode is enabled', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'app.visitJourneysGloballyDisabled') return false;
        if (key === 'app.visitJourneysLegacyGlobalOn') return true;
        if (key === 'TICKET_ALMOST_READY_POSITION') return defaultValue ?? '3';
        return defaultValue as never;
      });
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        defaultJourneyMode: 'visit_multi_step',
      });
      mockPrisma.service.findUnique.mockResolvedValue({
        orgId: 'org-1',
        journeyModeOverride: null,
      });
      mockPrisma.branchService.findUnique.mockResolvedValue({ journeyModeOverride: null });
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        { prefix: 'V', status: 'open', nextTicketSeq: 1, sessionClosesAt: null },
      ]);

      await service.issueTicket(
        'org-1',
        { queueId: 'queue-1', branchId: 'branch-1', serviceId: 'service-1', source: 'staff' },
        'authenticated',
      );

      expect(mockPrisma.visit.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visitId: 'visit-created-1' }),
        }),
      );
    });

    it('does not create visits when org journey flag is disabled', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'app.visitJourneysGloballyDisabled') return false;
        if (key === 'app.visitJourneysLegacyGlobalOn') return false;
        if (key === 'TICKET_ALMOST_READY_POSITION') return defaultValue ?? '3';
        return defaultValue as never;
      });
      mockPrisma.organization.findUnique.mockResolvedValue({ visitJourneysEnabled: false });
      mockPrisma.queue.findUnique.mockResolvedValue({
        id: 'queue-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'service-1',
        journeyModeOverride: 'visit_multi_step',
        status: 'open',
      });
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        { prefix: 'N', status: 'open', nextTicketSeq: 1, sessionClosesAt: null },
      ]);

      await service.issueTicket(
        'org-1',
        { queueId: 'queue-1', branchId: 'branch-1', serviceId: 'service-1', source: 'staff' },
        'authenticated',
      );

      expect(mockPrisma.visit.create).not.toHaveBeenCalled();
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visitId: null }),
        }),
      );
    });

    it('respects precedence branchService > service > branch for journey mode', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'app.visitJourneysGloballyDisabled') return false;
        if (key === 'app.visitJourneysLegacyGlobalOn') return true;
        if (key === 'TICKET_ALMOST_READY_POSITION') return defaultValue ?? '3';
        return defaultValue as never;
      });
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        defaultJourneyMode: 'visit_multi_step',
      });
      mockPrisma.service.findUnique.mockResolvedValue({
        orgId: 'org-1',
        journeyModeOverride: 'visit_multi_step',
      });
      mockPrisma.branchService.findUnique.mockResolvedValue({
        journeyModeOverride: 'single_ticket',
      });
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        { prefix: 'S', status: 'open', nextTicketSeq: 1, sessionClosesAt: null },
      ]);

      await service.issueTicket(
        'org-1',
        { queueId: 'queue-1', branchId: 'branch-1', serviceId: 'service-1', source: 'staff' },
        'authenticated',
      );

      expect(mockPrisma.visit.create).not.toHaveBeenCalled();
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visitId: null }),
        }),
      );
    });
  });

  describe('getQueueStats', () => {
    it('includes called tickets in active and total queue statistics', async () => {
      mockPrisma.ticket.groupBy.mockResolvedValue([
        { status: 'waiting', _count: { _all: 3 } },
        { status: 'called', _count: { _all: 2 } },
        { status: 'serving', _count: { _all: 1 } },
        { status: 'completed', _count: { _all: 4 } },
        { status: 'no_show', _count: { _all: 1 } },
      ]);
      mockPrisma.ticket.aggregate.mockResolvedValue({ _avg: { waitMinutes: 6.4 } });

      const result = await service.getQueueStats('org-1', 'queue-1');

      expect(result).toEqual(
        expect.objectContaining({
          waitingCount: 3,
          calledCount: 2,
          servingCount: 1,
          activeCount: 3,
          completedCount: 4,
          noShowCount: 1,
          totalToday: 11,
          completionRate: 36.4,
          noShowRate: 9.1,
          avgWaitMinutes: 6,
        }),
      );
    });
  });

  describe('getAgentPerformance', () => {
    it('returns backend-backed today performance for the current agent', async () => {
      mockPrisma.ticket.groupBy.mockResolvedValue([
        { status: 'called', _count: { _all: 1 } },
        { status: 'completed', _count: { _all: 3 } },
        { status: 'no_show', _count: { _all: 1 } },
      ]);
      mockPrisma.ticket.aggregate.mockResolvedValue({
        _avg: { waitMinutes: 5.6, serviceMinutes: 8.2 },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([
        { id: 'ticket-1', displayNumber: 'A001', status: 'completed' },
      ]);

      const result = await service.getAgentPerformance('org-1', 'queue-1', 'user-1');

      expect(result).toEqual(
        expect.objectContaining({
          completedToday: 3,
          noShowToday: 1,
          activeNow: 1,
          totalHandled: 4,
          completionRate: 75,
          avgWaitMinutes: 6,
          avgServiceMinutes: 8,
          recentOutcomes: [{ id: 'ticket-1', displayNumber: 'A001', status: 'completed' }],
        }),
      );
      expect(mockPrisma.ticket.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            queueId: 'queue-1',
            servedByUserId: 'user-1',
          }),
        }),
      );
    });
  });

  describe('getBranchAgentPerformance', () => {
    it('returns today branch performance for the current agent', async () => {
      mockPrisma.ticket.groupBy.mockResolvedValue([
        { status: 'called', _count: { _all: 2 } },
        { status: 'completed', _count: { _all: 4 } },
        { status: 'no_show', _count: { _all: 1 } },
      ]);
      mockPrisma.ticket.aggregate.mockResolvedValue({
        _avg: { waitMinutes: 10, serviceMinutes: 15 },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([
        { id: 't-1', displayNumber: 'M101', status: 'completed' },
      ]);

      const result = await service.getBranchAgentPerformance(
        'org-1',
        'branch-1',
        'user-1',
        'today',
      );

      expect(result).toEqual(
        expect.objectContaining({
          completedToday: 4,
          noShowToday: 1,
          activeNow: 2,
          totalHandled: 5,
          completionRate: 80,
          avgWaitMinutes: 10,
          avgServiceMinutes: 15,
          recentOutcomes: [{ id: 't-1', displayNumber: 'M101', status: 'completed' }],
        }),
      );
    });

    it('filters by multi-step journey tickets when forJourney is true', async () => {
      mockPrisma.ticket.groupBy.mockResolvedValue([]);
      mockPrisma.ticket.aggregate.mockResolvedValue({
        _avg: { waitMinutes: null, serviceMinutes: null },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.getBranchAgentPerformance('org-1', 'branch-1', 'user-1', 'today', true);

      expect(mockPrisma.ticket.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            branchId: 'branch-1',
            servedByUserId: 'user-1',
            visitId: { not: null },
          }),
        }),
      );
    });

    it('filters by single-step tickets when forJourney is false', async () => {
      mockPrisma.ticket.groupBy.mockResolvedValue([]);
      mockPrisma.ticket.aggregate.mockResolvedValue({
        _avg: { waitMinutes: null, serviceMinutes: null },
      });
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.getBranchAgentPerformance('org-1', 'branch-1', 'user-1', 'today', false);

      expect(mockPrisma.ticket.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            branchId: 'branch-1',
            servedByUserId: 'user-1',
            visitId: null,
          }),
        }),
      );
    });
  });

  describe('ticket transition errors', () => {
    it('throws TICKET_INVALID_TRANSITION with structured details', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        visitId: null,
        stepIndex: null,
        queueId: 'queue-1',
      });
      mockTicketLock('completed');
      mockPrisma.ticket.findFirst.mockImplementation(
        (args: { select?: Record<string, boolean> }) => {
          const select = args?.select;
          const statusOnly = select && select.status === true && Object.keys(select).length === 1;
          if (statusOnly) {
            return Promise.resolve({ status: 'completed' });
          }
          return Promise.resolve({
            id: 'ticket-1',
            orgId: 'org-1',
            status: 'completed',
            queueId: 'queue-1',
            branchId: 'branch-1',
            bookedAt: new Date(),
            servedAt: null,
            calledAt: null,
          });
        },
      );

      try {
        await service.serve('org-1', 'ticket-1', 'user-1');
        expect.fail('expected BadRequestException');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = (err as BadRequestException).getResponse();
        expect(response).toMatchObject({
          code: 'TICKET_INVALID_TRANSITION',
          message: expect.stringContaining('completed'),
          details: {
            currentStatus: 'completed',
            allowedStatuses: ['called'],
            targetStatus: 'serving',
          },
        });
      }
    });
  });

  describe('structured errors and idempotent workbench actions', () => {
    const statusOnlySelect = (select?: Record<string, boolean>) => select?.status === true;

    it('serve is idempotent when ticket is already serving', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        visitId: null,
        stepIndex: null,
        queueId: 'queue-1',
      });
      mockTicketLock('serving');
      mockPrisma.ticket.findFirst.mockImplementation(
        (args: { select?: Record<string, boolean>; include?: unknown }) => {
          if (statusOnlySelect(args?.select)) {
            return Promise.resolve({ status: 'serving' });
          }
          return Promise.resolve({
            id: 'ticket-1',
            displayNumber: 'A001',
            queue: { id: 'queue-1', name: 'Main' },
            service: { id: 'service-1', name: 'Consult' },
          });
        },
      );

      const result = await service.serve('org-1', 'ticket-1', 'user-1');

      expect(result).toMatchObject({ id: 'ticket-1', displayNumber: 'A001' });
      expect(mockPrisma.withTenant).toHaveBeenCalled();
    });

    it('noShow throws TICKET_INVALID_TRANSITION when ticket is cancelled', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        visitId: 'visit-1',
        stepIndex: 1,
        queueId: 'queue-1',
      });
      mockTicketLock('cancelled');
      mockPrisma.ticket.findFirst.mockImplementation(
        (args: { select?: Record<string, boolean> }) => {
          if (statusOnlySelect(args?.select)) {
            return Promise.resolve({ status: 'cancelled' });
          }
          return Promise.resolve({
            id: 'ticket-1',
            orgId: 'org-1',
            status: 'cancelled',
            queueId: 'queue-1',
            branchId: 'branch-1',
            bookedAt: new Date(),
            servedAt: null,
            calledAt: null,
          });
        },
      );

      await expect(
        service.noShow('org-1', 'ticket-1', 'user-1', 'workbench'),
      ).rejects.toMatchObject({
        response: {
          code: 'TICKET_INVALID_TRANSITION',
          details: expect.objectContaining({
            currentStatus: 'cancelled',
            allowedStatuses: ['called', 'serving'],
            targetStatus: 'no_show',
          }),
        },
      });
    });

    it('routes duplicate complete clicks through finalize logic safely', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        visitId: 'visit-1',
        stepIndex: 1,
        queueId: 'queue-1',
      });

      let statusChecks = 0;
      mockPrisma.$queryRaw.mockImplementation(() => {
        statusChecks += 1;
        const status = statusChecks === 1 ? 'serving' : 'completed';
        return Promise.resolve([{ status, ...ticketLockDefaults }]);
      });
      mockPrisma.ticket.findFirst.mockImplementation(
        (args: { select?: Record<string, boolean>; include?: unknown }) => {
          if (statusOnlySelect(args?.select)) {
            statusChecks += 1;
            return Promise.resolve({
              status: statusChecks === 1 ? 'serving' : 'completed',
            });
          }
          return Promise.resolve({
            id: 'ticket-1',
            displayNumber: 'A001',
            queue: { id: 'queue-1', name: 'Reception' },
            service: { id: 'service-1', name: 'Consult' },
          });
        },
      );

      const finalizeSpy = vi
        .spyOn(
          service as unknown as { finalizeTicketWithJourneyAdvance: () => Promise<unknown> },
          'finalizeTicketWithJourneyAdvance',
        )
        .mockResolvedValue({ ticket: { id: 'ticket-1', status: 'completed' }, nextTicket: null });

      await service.complete('org-1', 'ticket-1', 'user-1', undefined, 'workbench');
      await service.complete('org-1', 'ticket-1', 'user-1', undefined, 'workbench');

      expect(finalizeSpy).toHaveBeenCalledTimes(2);
      finalizeSpy.mockRestore();
    });
  });

  describe('idempotent terminal actions', () => {
    it('complete returns existing terminal ticket and follow-up ticket when already completed', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        queueId: 'queue-1',
        visitId: 'visit-1',
        stepIndex: 1,
        branchId: 'branch-1',
        customerId: null,
        customerName: 'Alice',
        customerPhone: null,
        language: 'en',
        externalRef: null,
        queue: { stepRole: 'service' },
      });
      mockWorkflow.getNextStep.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: 'completed',
          visitId: 'visit-1',
          stepIndex: 1,
          flowTemplateId: null,
        },
      ]);
      mockPrisma.ticket.findFirst
        .mockResolvedValueOnce({
          id: 'ticket-1',
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

      const result = await service.complete('org-1', 'ticket-1', 'user-1', undefined, 'workbench');

      expect(result.ticket).toMatchObject({
        id: 'ticket-1',
        displayNumber: 'A001',
      });
      expect(result.nextTicket).toMatchObject({
        id: 'ticket-2',
        displayNumber: 'A002',
      });
      expect(mockPrisma.withTenant).toHaveBeenCalled();
    });

    it('does not re-issue next step when complete is retried after success', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        queueId: 'queue-1',
        visitId: 'visit-1',
        stepIndex: 1,
        branchId: 'branch-1',
        customerId: null,
        customerName: 'Alice',
        customerPhone: null,
        language: 'en',
        externalRef: null,
        queue: { stepRole: 'service' },
      });
      mockWorkflow.getNextStep.mockResolvedValue({
        queueId: 'queue-2',
        serviceId: 'service-2',
        stepIndex: 2,
      });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: 'completed',
          visitId: 'visit-1',
          stepIndex: 1,
          flowTemplateId: null,
        },
      ]);
      mockPrisma.ticket.findFirst
        .mockResolvedValueOnce({
          id: 'ticket-1',
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

      const issueSpy = vi
        .spyOn(service as unknown as { issueTicketCore: () => Promise<unknown> }, 'issueTicketCore')
        .mockResolvedValue({ id: 'ticket-2' });

      await service.complete('org-1', 'ticket-1', 'user-1', undefined, 'workbench');

      expect(issueSpy).not.toHaveBeenCalled();
      issueSpy.mockRestore();
    });

    it('noShow returns existing ticket when already no_show', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        queueId: 'queue-1',
        visitId: 'visit-1',
        stepIndex: 1,
      });
      mockPrisma.ticket.findFirst.mockImplementation(
        (args: { select?: Record<string, boolean>; include?: unknown }) => {
          const select = args?.select;
          const statusOnly = select && select.status === true && Object.keys(select).length === 1;
          if (statusOnly) {
            return Promise.resolve({ status: 'no_show' });
          }
          return Promise.resolve({
            id: 'ticket-1',
            displayNumber: 'A002',
            queue: { id: 'queue-1', name: 'Reception' },
            service: { id: 'service-1', name: 'Consult' },
          });
        },
      );

      const result = await service.noShow('org-1', 'ticket-1', 'user-1', 'workbench');

      expect(result).toMatchObject({ id: 'ticket-1', displayNumber: 'A002' });
      expect(mockPrisma.withTenant).toHaveBeenCalled();
    });
  });

  describe('recall', () => {
    it('re-call from called sends notifyTicketCalled', async () => {
      const orgId = 'org-1';
      const ticketId = 'ticket-1';
      const userId = 'user-1';

      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: ticketId,
        visitId: null,
        stepIndex: null,
        queueId: 'queue-1',
        status: 'called',
      });
      mockTicketLock('called');
      mockPrisma.ticket.findFirst.mockResolvedValue({
        id: ticketId,
        orgId,
        status: 'called',
        queueId: 'queue-1',
        branchId: 'branch-1',
      });

      mockPrisma.ticket.update.mockResolvedValue({
        id: ticketId,
        displayNumber: 'A10',
        deskNumber: '5',
        customerPhone: '+1234567890',
        queue: { name: 'Main Queue' },
        transactionalSmsAllowed: true,
      });

      await service.recall(orgId, ticketId, userId, 'classic', '2');

      expect(mockNotifications.notifyTicketCalled).toHaveBeenCalledWith(
        orgId,
        ticketId,
        expect.objectContaining({
          displayNumber: 'A10',
          deskNumber: '5',
          customerPhone: '+1234567890',
          queueName: 'Main Queue',
        }),
      );
      expect(mockNotifications.notifyTicketRecalled).not.toHaveBeenCalled();
    });

    it('back-to-called from serving sends apology via notifyTicketRecalled', async () => {
      const orgId = 'org-1';
      const ticketId = 'ticket-1';
      const userId = 'user-1';

      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: ticketId,
        visitId: null,
        stepIndex: null,
        queueId: 'queue-1',
        status: 'serving',
      });
      mockTicketLock('serving');
      mockPrisma.ticket.findFirst.mockResolvedValue({
        id: ticketId,
        orgId,
        status: 'serving',
        queueId: 'queue-1',
        branchId: 'branch-1',
      });

      mockPrisma.ticket.update.mockResolvedValue({
        id: ticketId,
        displayNumber: 'A10',
        deskNumber: '5',
        customerPhone: '+1234567890',
        queue: { name: 'Main Queue' },
        transactionalSmsAllowed: true,
      });

      await service.recall(orgId, ticketId, userId);

      expect(mockNotifications.notifyTicketRecalled).toHaveBeenCalledWith(
        orgId,
        ticketId,
        expect.objectContaining({
          displayNumber: 'A10',
          deskNumber: '5',
          isUndo: true,
        }),
      );
      expect(mockNotifications.notifyTicketCalled).not.toHaveBeenCalled();
    });

    it('re-call from called after back-to-called clears resummon flag (no duplicate SMS on serve)', async () => {
      const orgId = 'org-1';
      const ticketId = 'ticket-1';
      const userId = 'user-1';

      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: ticketId,
        visitId: null,
        stepIndex: null,
        queueId: 'queue-1',
        status: 'called',
        metadata: { resummonSmsOnServe: true },
      });
      mockTicketLock('called');
      mockPrisma.ticket.findFirst.mockResolvedValue({
        id: ticketId,
        orgId,
        status: 'called',
        queueId: 'queue-1',
        branchId: 'branch-1',
      });

      mockPrisma.ticket.update.mockResolvedValue({
        id: ticketId,
        displayNumber: 'A10',
        deskNumber: '1',
        customerPhone: '+1234567890',
        queue: { name: 'Main Queue' },
        transactionalSmsAllowed: true,
      });

      await service.recall(orgId, ticketId, userId);

      expect(mockNotifications.notifyTicketCalled).toHaveBeenCalled();
      const updateArg = mockPrisma.ticket.update.mock.calls.at(-1)?.[0];
      const metadata = updateArg?.data?.metadata;
      expect(
        metadata == null || (typeof metadata === 'object' && !('resummonSmsOnServe' in metadata)),
      ).toBe(true);
    });

    it('serve after back-to-called sends notifyTicketCalled (re-summon)', async () => {
      const orgId = 'org-1';
      const ticketId = 'ticket-1';
      const userId = 'user-1';

      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: ticketId,
        visitId: null,
        stepIndex: null,
        queueId: 'queue-1',
        status: 'called',
      });
      mockTicketLock('called');
      mockPrisma.ticket.findFirst.mockImplementation(
        (args: { select?: Record<string, boolean>; include?: unknown }) => {
          if (args?.select?.status === true) {
            return Promise.resolve({
              status: 'called',
              branchId: 'branch-1',
              deskNumber: '1',
              metadata: { resummonSmsOnServe: true },
            });
          }
          return Promise.resolve({
            id: ticketId,
            displayNumber: 'PD1015',
            deskNumber: '1',
            customerPhone: '+14155558530',
            transactionalSmsAllowed: true,
            queue: { id: 'queue-1', name: 'Phone Demo' },
            service: { id: 's1', name: 'Lab' },
          });
        },
      );

      mockPrisma.ticket.update.mockResolvedValue({
        id: ticketId,
        displayNumber: 'PD1015',
        deskNumber: '1',
        customerPhone: '+14155558530',
        transactionalSmsAllowed: true,
        queue: { name: 'Phone Demo' },
      });

      await service.serve(orgId, ticketId, userId);

      expect(mockNotifications.notifyTicketCalled).toHaveBeenCalledWith(
        orgId,
        ticketId,
        expect.objectContaining({
          displayNumber: 'PD1015',
          deskNumber: '1',
          customerPhone: '+14155558530',
          queueName: 'Phone Demo',
        }),
      );
    });
  });

  describe('Multi-step Journey and Reactivation', () => {
    it('reactivates completed visit in createVisitStep', async () => {
      mockPrisma.visit.findFirst.mockResolvedValue({
        id: 'visit-1',
        branchId: 'branch-1',
        status: 'completed',
        customerName: 'Test Name',
        customerPhone: '+1234567890',
        language: 'en',
      });
      mockPrisma.visit.update.mockResolvedValue({ id: 'visit-1', status: 'active' });

      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'app.visitJourneysGloballyDisabled') return false;
        if (key === 'app.visitJourneysLegacyGlobalOn') return true;
        return defaultValue as never;
      });
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        defaultJourneyMode: 'visit_multi_step',
      });
      mockPrisma.service.findUnique.mockResolvedValue({
        orgId: 'org-1',
        journeyModeOverride: null,
      });
      mockPrisma.branchService.findUnique.mockResolvedValue({ journeyModeOverride: null });
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        { prefix: 'V', status: 'open', nextTicketSeq: 1, sessionClosesAt: null },
      ]);
      mockPrisma.ticket.create.mockResolvedValue({ id: 'ticket-2', displayNumber: 'V02' });
      mockPrisma.queue.findUnique.mockResolvedValue({
        id: 'queue-2',
        orgId: 'org-1',
        branchId: 'branch-1',
        serviceId: 'service-2',
        status: 'open',
        journeyModeOverride: null,
        stepRole: 'service',
      });

      await service.createVisitStep('org-1', 'visit-1', {
        queueId: 'queue-2',
        serviceId: 'service-2',
      });

      expect(mockPrisma.visit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'visit-1' },
          data: expect.objectContaining({ status: 'active', completedAt: null }),
        }),
      );
      expect(mockPrisma.ticket.create).toHaveBeenCalled();
    });

    it('reactivates completed visit in issueTicket (withTenant transaction)', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'app.visitJourneysGloballyDisabled') return false;
        if (key === 'app.visitJourneysLegacyGlobalOn') return true;
        return defaultValue as never;
      });
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        defaultJourneyMode: 'visit_multi_step',
      });
      mockPrisma.service.findUnique.mockResolvedValue({
        orgId: 'org-1',
        journeyModeOverride: null,
      });
      mockPrisma.branchService.findUnique.mockResolvedValue({ journeyModeOverride: null });
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([
        { prefix: 'V', status: 'open', nextTicketSeq: 1, sessionClosesAt: null },
      ]);
      mockPrisma.ticket.create.mockResolvedValue({ id: 'ticket-2', displayNumber: 'V02' });

      const txMock = {
        $queryRaw: vi
          .fn()
          .mockResolvedValue([
            { prefix: 'V', status: 'open', nextTicketSeq: 1, sessionClosesAt: null },
          ]),
        visit: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'visit-1',
            status: 'completed',
          }),
          findUnique: vi.fn().mockResolvedValue({ id: 'visit-1', externalRef: null }),
          update: vi.fn().mockResolvedValue({ id: 'visit-1', status: 'active' }),
          create: vi.fn(),
        },
        ticket: {
          create: vi
            .fn()
            .mockResolvedValue({ id: 'ticket-2', displayNumber: 'V02', visitId: 'visit-1' }),
          count: vi.fn().mockResolvedValue(0),
          update: vi.fn(),
          findFirst: vi.fn().mockResolvedValue({ displayNumber: 'V01' }),
        },
        queue: {
          update: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({
            id: 'queue-2',
            orgId: 'org-1',
            branchId: 'branch-1',
            serviceId: 'service-2',
            status: 'open',
            journeyModeOverride: null,
            stepRole: 'service',
          }),
        },
        branchService: {
          findUnique: vi.fn().mockResolvedValue({ journeyModeOverride: null }),
        },
        service: {
          findUnique: vi.fn().mockResolvedValue({ orgId: 'org-1', journeyModeOverride: null }),
        },
        branch: {
          findUnique: vi.fn().mockResolvedValue({
            orgId: 'org-1',
            defaultJourneyMode: 'visit_multi_step',
            timezone: 'UTC',
          }),
        },
        branchDateOverride: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        workingHours: {
          findUnique: vi.fn().mockResolvedValue({
            openTime: '00:00',
            closeTime: '23:59',
            isClosed: false,
            breakStart: null,
            breakEnd: null,
          }),
        },
        branchFlowTemplate: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        branchFlowStep: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      mockPrisma.withTenant.mockImplementation((orgId, cb) => cb(txMock));

      await service.issueTicket(
        'org-1',
        {
          branchId: 'branch-1',
          queueId: 'queue-2',
          serviceId: 'service-2',
          visitId: 'visit-1',
          source: 'staff',
        },
        'authenticated',
      );

      expect(txMock.visit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'visit-1' },
          data: expect.objectContaining({ status: 'active', completedAt: null }),
        }),
      );
    });

    it('reuses original ticket displayNumber for subsequent steps', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'app.visitJourneysGloballyDisabled') return false;
        if (key === 'app.visitJourneysLegacyGlobalOn') return true;
        return defaultValue as never;
      });
      mockPrisma.branch.findUnique.mockResolvedValue({
        orgId: 'org-1',
        defaultJourneyMode: 'visit_multi_step',
      });
      mockPrisma.service.findUnique.mockResolvedValue({
        orgId: 'org-1',
        journeyModeOverride: null,
      });
      mockPrisma.branchService.findUnique.mockResolvedValue({ journeyModeOverride: null });
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.ticket.create.mockResolvedValue({
        id: 'ticket-2',
        displayNumber: 'V01',
        visitId: 'visit-1',
      });

      const txMock = {
        $queryRaw: vi
          .fn()
          .mockResolvedValue([
            { prefix: 'V', status: 'open', nextTicketSeq: 1, sessionClosesAt: null },
          ]),
        visit: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'visit-1',
            status: 'active',
          }),
          findUnique: vi.fn().mockResolvedValue({ id: 'visit-1', externalRef: null }),
          update: vi.fn(),
          create: vi.fn(),
        },
        ticket: {
          create: vi
            .fn()
            .mockResolvedValue({ id: 'ticket-2', displayNumber: 'V01', visitId: 'visit-1' }),
          count: vi.fn().mockResolvedValue(0),
          update: vi.fn(),
          findFirst: vi.fn().mockResolvedValue({ displayNumber: 'V01' }),
        },
        queue: {
          update: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({
            id: 'queue-2',
            orgId: 'org-1',
            branchId: 'branch-1',
            serviceId: 'service-2',
            status: 'open',
            journeyModeOverride: null,
            stepRole: 'service',
          }),
        },
        branchService: {
          findUnique: vi.fn().mockResolvedValue({ journeyModeOverride: null }),
        },
        service: {
          findUnique: vi.fn().mockResolvedValue({ orgId: 'org-1', journeyModeOverride: null }),
        },
        branch: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              orgId: 'org-1',
              defaultJourneyMode: 'visit_multi_step',
              timezone: 'UTC',
            }),
        },
        branchDateOverride: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        workingHours: {
          findUnique: vi.fn().mockResolvedValue({
            openTime: '00:00',
            closeTime: '23:59',
            isClosed: false,
            breakStart: null,
            breakEnd: null,
          }),
        },
        branchFlowTemplate: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        branchFlowStep: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      mockPrisma.withTenant.mockImplementation((orgId, cb) => cb(txMock));

      await service.issueTicket(
        'org-1',
        {
          branchId: 'branch-1',
          queueId: 'queue-2',
          serviceId: 'service-2',
          visitId: 'visit-1',
          source: 'staff',
        },
        'authenticated',
      );

      expect(txMock.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { visitId: 'visit-1', orgId: 'org-1' },
        }),
      );
      expect(txMock.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayNumber: 'V01' }),
        }),
      );
    });
  });

  describe('deleteHistoryTicket', () => {
    const completedTicket = {
      id: 'ticket-del-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      queueId: 'queue-1',
      visitId: null,
      status: 'completed',
      legalHold: false,
      displayNumber: 'A001',
    };

    beforeEach(() => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-owner' });
      mockPrisma.roleAssignment.findFirst.mockResolvedValue({ id: 'ra-owner' });
      mockPrisma.ticket.findFirst.mockResolvedValue(completedTicket);
      mockPrisma.ticket.delete.mockResolvedValue(completedTicket);
      mockPrisma.ticket.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.ticket.findMany.mockResolvedValue([completedTicket]);
    });

    it('rejects non-owner actors', async () => {
      mockPrisma.roleAssignment.findFirst.mockResolvedValue(null);
      await expect(service.deleteHistoryTicket('org-1', 'staff-1', 'ticket-del-1')).rejects.toThrow(
        /organization owner/i,
      );
    });

    it('rejects deleting active queue tickets', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue({ ...completedTicket, status: 'waiting' });
      await expect(service.deleteHistoryTicket('org-1', 'owner-1', 'ticket-del-1')).rejects.toThrow(
        /Active queue tickets cannot be deleted/i,
      );
    });

    it('deletes a completed ticket for the owner', async () => {
      const result = await service.deleteHistoryTicket('org-1', 'owner-1', 'ticket-del-1');
      expect(result).toEqual({ deleted: true, id: 'ticket-del-1' });
      expect(mockPrisma.ticket.delete).toHaveBeenCalledWith({ where: { id: 'ticket-del-1' } });
      expect(mockAudit.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ticket.history_deleted', resourceId: 'ticket-del-1' }),
      );
    });

    it('bulk-deletes eligible tickets and reports blocked items', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([
        completedTicket,
        { ...completedTicket, id: 'ticket-active', status: 'waiting', legalHold: false },
      ]);

      const result = await service.deleteHistoryTicketsBulk('org-1', 'owner-1', [
        'ticket-del-1',
        'ticket-active',
        'missing-id',
      ]);

      expect(result.deleted).toBe(1);
      expect(result.blocked).toHaveLength(1);
      expect(result.notFound).toEqual(['missing-id']);
      expect(mockPrisma.ticket.deleteMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', id: { in: ['ticket-del-1'] } },
      });
    });
  });

  describe('list ordering', () => {
    it('keeps waiting position order for live queue slice when period is week', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([]);
      mockPrisma.ticket.count.mockResolvedValue(0);

      await service.list('org-1', {
        queueId: 'queue-1',
        status: 'waiting,called,serving',
        period: 'week',
      });

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ position: { sort: 'asc', nulls: 'last' } }, { bookedAt: 'asc' }],
        }),
      );
    });

    it('uses bookedAt desc for week history lists without a live queue filter', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([]);
      mockPrisma.ticket.count.mockResolvedValue(0);

      await service.list('org-1', {
        period: 'week',
        status: 'completed',
      });

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ bookedAt: 'desc' }],
        }),
      );
    });
  });

  describe('surface isolation contracts', () => {
    it('rejects classic completion on journey-backed tickets', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-journey',
        queueId: 'queue-1',
        visitId: 'visit-1',
        stepIndex: 1,
      });

      await expect(
        service.complete('org-1', 'ticket-journey', 'user-1', undefined, 'classic'),
      ).rejects.toThrow(/multi-step journey/i);
    });

    it('rejects workbench mark-ready on classic single-step tickets', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-classic',
        queueId: 'queue-1',
        visitId: null,
        stepIndex: null,
        status: 'waiting',
        readyAt: null,
        branchId: 'branch-1',
        displayNumber: 'A001',
        customerPhone: null,
      });
      mockPrisma.queue.findUnique.mockResolvedValue({
        id: 'queue-1',
        journeyModeOverride: null,
        flowTemplateId: null,
      });

      await expect(
        service.markReady('org-1', 'ticket-classic', 'user-1', 'workbench'),
      ).rejects.toThrow(/single-step/i);
    });
  });
});
