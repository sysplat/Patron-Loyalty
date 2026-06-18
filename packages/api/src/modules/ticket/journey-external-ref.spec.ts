import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketService } from './ticket.service';

import { mockRequestContext } from '../../test/mock-request-context';

/**
 * Journey transaction ref (externalRef) is required from step 1 and carried across all steps.
 */
describe('TicketService — journey receipt (externalRef)', () => {
  const orgId = 'org-1';
  const visitId = 'visit-1';
  const step1TicketId = 'ticket-step-1';
  const userId = 'user-1';

  const journeyContext = {
    id: step1TicketId,
    visitId,
    stepIndex: 1,
    branchId: 'branch-1',
    queueId: 'q-order',
    customerId: 'cust-1',
    customerName: 'Jane',
    customerPhone: '+15551234567',
    language: 'en',
    externalRef: null as string | null,
    queue: { stepRole: 'service' as const },
  };

  const mockPrisma = {
    ticket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _max: { stepIndex: 1 } }),
      create: vi.fn(),
      update: vi.fn(),
    },
    visit: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    queue: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    customer: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    branch: { findUnique: vi.fn(), findFirst: vi.fn() },
    service: { findUnique: vi.fn() },
    branchService: { findUnique: vi.fn() },
    branchFlowTemplate: { findFirst: vi.fn() },
    branchFlowStep: { findFirst: vi.fn(), findMany: vi.fn() },
    organization: { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }) },
    withTenant: vi.fn(),
    withBypassRls: vi.fn(),
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
      if (key === 'app.visitJourneysLegacyGlobalOn') return true;
      if (key === 'TICKET_ALMOST_READY_POSITION') return defaultValue ?? '3';
      return defaultValue as never;
    }),
  };

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
    getLimits: vi.fn(),
    requireFeature: vi.fn(),
  };

  const mockWorkflow = { getNextStep: vi.fn() };
  const mockStaffGuards = {
    assertQueueNotClosedForStaffActions: vi.fn().mockResolvedValue(undefined),
    assertClassicDeskAssignmentForBranch: vi.fn().mockResolvedValue(undefined),
  };

  let service: TicketService;
  let issueTxMock: ReturnType<typeof buildIssueTxMock>;
  let transferCreatePayload: Record<string, unknown> | undefined;
  let transferCompleteUpdatePayload: Record<string, unknown> | undefined;

  const servingTicketRow = {
    status: 'serving',
    queueId: 'q-order',
    branchId: 'branch-1',
    orgId,
    bookedAt: new Date('2026-05-18T10:00:00Z'),
    servedAt: new Date('2026-05-18T10:05:00Z'),
    calledAt: new Date('2026-05-18T10:04:00Z'),
  };

  function buildIssueTxMock() {
    return {
      $queryRaw: vi.fn().mockResolvedValue([{ status: 'serving', visitId, stepIndex: 1 }]),
      visit: {
        findFirst: vi.fn().mockResolvedValue({ id: visitId, status: 'active' }),
        findUnique: vi.fn().mockResolvedValue({ id: visitId, externalRef: null }),
        update: vi.fn(),
      },
      ticket: {
        findUnique: vi.fn().mockResolvedValue(journeyContext),
        aggregate: vi.fn().mockResolvedValue({ _max: { stepIndex: 1 } }),
        count: vi.fn().mockResolvedValue(10),
        findFirst: vi
          .fn()
          .mockImplementation((args: { where?: Record<string, unknown>; orderBy?: unknown }) => {
            const where = args?.where ?? {};
            if (where.externalRef && (where.externalRef as { not: null }).not === null) {
              return Promise.resolve({ externalRef: 'R-from-sibling' });
            }
            if (where.visitId === visitId && args.orderBy) {
              return Promise.resolve({ displayNumber: 'A0002' });
            }
            return Promise.resolve(servingTicketRow);
          }),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'ticket-step-2',
            ...data,
            queueId: data.queueId,
            branchId: data.branchId,
            displayNumber: 'A0002',
            queue: { id: data.queueId, name: 'Pickup' },
            service: { id: data.serviceId, name: 'Pickup' },
          }),
        ),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: step1TicketId,
            orgId,
            queueId: 'q-order',
            branchId: 'branch-1',
            visitId,
            ...data,
            queue: { id: 'q-order', name: 'Order' },
            service: { id: 'svc-order', name: 'Order' },
          }),
        ),
      },
      queue: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'q-pickup',
          orgId,
          branchId: 'branch-1',
          serviceId: 'svc-pickup',
          status: 'open',
          journeyModeOverride: null,
          stepRole: 'pickup',
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'q-pickup',
          orgId,
          branchId: 'branch-1',
          serviceId: 'svc-pickup',
          status: 'open',
          journeyModeOverride: null,
          stepRole: 'pickup',
        }),
        update: vi.fn(),
      },
      branch: {
        findUnique: vi.fn().mockResolvedValue({ orgId, defaultJourneyMode: 'visit_multi_step' }),
      },
      service: { findUnique: vi.fn().mockResolvedValue({ orgId, journeyModeOverride: null }) },
      branchService: { findUnique: vi.fn().mockResolvedValue({ journeyModeOverride: null }) },
      branchFlowTemplate: { findFirst: vi.fn().mockResolvedValue({ id: 'tpl-1' }) },
      branchFlowStep: {
        findFirst: vi.fn().mockResolvedValue({ stepIndex: 2 }),
        findMany: vi.fn().mockResolvedValue([
          { queueId: 'q-order', serviceId: 'svc-order', stepIndex: 1 },
          { queueId: 'q-pickup', serviceId: 'svc-pickup', stepIndex: 2 },
        ]),
      },
      customer: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({
          id: 'cust-1',
          name: 'Jane',
          phone: '+15551234567',
          transactionalSmsAllowed: true,
        }),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
  }

  function buildTransferTxMock(sourceExternalRef: string | null) {
    return {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { prefix: 'A', status: 'open', nextTicketSeq: 3, sessionClosesAt: null },
        ]),
      visit: {
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          externalRef: sourceExternalRef,
        }),
        update: vi.fn(),
      },
      ticket: {
        findUnique: vi.fn().mockResolvedValue({
          id: step1TicketId,
          orgId,
          visitId,
          branchId: 'branch-1',
          queueId: 'q-order',
          stepIndex: 1,
          customerId: 'cust-1',
          customerName: 'Jane',
          customerPhone: '+15551234567',
          language: 'en',
          externalRef: sourceExternalRef,
          priority: 0,
          source: 'kiosk',
          note: null,
          queue: { flowTemplateId: 'tpl-1', stepRole: 'service' },
          visit: { id: visitId },
        }),
        findFirst: vi.fn().mockImplementation((args: { where?: Record<string, unknown> }) => {
          const where = args?.where ?? {};
          if (where.externalRef && (where.externalRef as { not: null }).not === null) {
            return Promise.resolve(sourceExternalRef ? { externalRef: sourceExternalRef } : null);
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          transferCompleteUpdatePayload = data;
          return Promise.resolve({});
        }),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          transferCreatePayload = data;
          return Promise.resolve({
            id: 'ticket-step-2',
            ...data,
            queue: { id: data.queueId, name: 'Pickup' },
            service: { id: data.serviceId, name: 'Pickup' },
          });
        }),
      },
      queue: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === 'q-order') {
            return Promise.resolve({
              id: 'q-order',
              orgId,
              branchId: 'branch-1',
              serviceId: 'svc-order',
              status: 'open',
            });
          }
          return Promise.resolve({
            id: 'q-pickup',
            orgId,
            branchId: 'branch-1',
            serviceId: 'svc-pickup',
            status: 'open',
            stepRole: 'pickup',
          });
        }),
        findFirst: vi.fn().mockImplementation((args?: { where?: { id?: string } }) => {
          const id = args?.where?.id;
          if (id === 'q-order') {
            return Promise.resolve({
              id: 'q-order',
              orgId,
              branchId: 'branch-1',
              serviceId: 'svc-order',
              status: 'open',
            });
          }
          return Promise.resolve({
            id: 'q-pickup',
            orgId,
            branchId: 'branch-1',
            serviceId: 'svc-pickup',
            status: 'open',
            stepRole: 'pickup',
          });
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      branchFlowTemplate: {
        findFirst: vi.fn().mockResolvedValue({ id: 'tpl-1' }),
      },
      branchFlowStep: {
        findMany: vi.fn().mockResolvedValue([
          { queueId: 'q-order', stepIndex: 1 },
          { queueId: 'q-pickup', stepIndex: 2 },
        ]),
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    transferCreatePayload = undefined;
    transferCompleteUpdatePayload = undefined;
    issueTxMock = buildIssueTxMock();

    mockNotifications.notifyTicketIssued.mockResolvedValue(undefined);
    mockNotifications.notifyTicketCalled.mockResolvedValue(undefined);
    mockNotifications.notifyTicketAlmostReady.mockResolvedValue(undefined);
    mockNotifications.notifyTicketRecalled.mockResolvedValue(undefined);
    mockPlanLimits.checkLimit.mockResolvedValue({
      allowed: true,
      limitReached: false,
      limit: 1000,
      current: 0,
      feature: 'maxTicketsPerMonth',
    });

    mockPrisma.ticket.count.mockResolvedValue(10);
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({ id: 'tpl-1' });
    mockPrisma.branchFlowStep.findFirst.mockResolvedValue({ stepIndex: 1 });
    mockWorkflow.getNextStep.mockResolvedValue({
      stepIndex: 2,
      queueId: 'q-pickup',
      serviceId: 'svc-pickup',
    });
    mockPrisma.ticket.findUnique.mockResolvedValue(journeyContext);
    mockPrisma.ticket.findFirst.mockImplementation((args: { select?: Record<string, boolean> }) => {
      const select = args?.select;
      if (select && select.status === true && Object.keys(select).length === 1) {
        return Promise.resolve({ status: 'serving' });
      }
      return Promise.resolve(null);
    });
    mockPrisma.withTenant.mockImplementation(
      async (_org: string, cb: (tx: unknown) => Promise<unknown>) => cb(issueTxMock as never),
    );
    mockPrisma.withBypassRls.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(mockPrisma as never),
    );
    mockPrisma.queue.findFirst.mockImplementation((args?: { where?: { id?: string } }) => {
      const id = args?.where?.id;
      if (id === 'q-pickup') {
        return Promise.resolve({
          id: 'q-pickup',
          orgId,
          branchId: 'branch-1',
          serviceId: 'svc-pickup',
          status: 'open',
          callingPolicy: 'fifo',
          stepRole: 'pickup',
        });
      }
      return Promise.resolve({
        id: 'q-order',
        orgId,
        branchId: 'branch-1',
        serviceId: 'svc-order',
        status: 'open',
        callingPolicy: 'fifo',
        stepRole: 'service',
      });
    });
    mockPrisma.queue.findUnique.mockResolvedValue({
      id: 'q-order',
      orgId,
      branchId: 'branch-1',
      serviceId: 'svc-order',
      status: 'open',
      callingPolicy: 'fifo',
      stepRole: 'service',
      flowTemplateId: 'tpl-1',
    });

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

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  describe('complete() — advance to step 2', () => {
    it('persists explicit receipt when completing step 1', async () => {
      await service.complete(orgId, step1TicketId, userId, 'R-883', 'workbench');

      expect(issueTxMock.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visitId,
            queueId: 'q-pickup',
          }),
        }),
      );
      const createCall = issueTxMock.ticket.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(createCall.data.externalRef).toBe('R-883');

      const updateCall = issueTxMock.ticket.update.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.externalRef).toBe('R-883');

      expect(issueTxMock.visit.update).toHaveBeenCalledWith({
        where: { id: visitId, orgId },
        data: { externalRef: 'R-883' },
      });
    });

    it('inherits visit receipt when completing step 1 without explicit ref', async () => {
      issueTxMock.visit.findUnique.mockResolvedValue({
        id: visitId,
        externalRef: 'R-saved-earlier',
      });

      await service.complete(orgId, step1TicketId, userId, undefined, 'workbench');

      const createCall = issueTxMock.ticket.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(createCall.data.externalRef).toBe('R-saved-earlier');
    });

    it('requires externalRef when receipt is blank and visit has no saved receipt', async () => {
      mockPrisma.ticket.findFirst.mockImplementation(
        (args: { select?: Record<string, boolean> }) => {
          const select = args?.select;
          if (select && select.status === true && Object.keys(select).length === 1) {
            return Promise.resolve({ status: 'serving' });
          }
          return Promise.resolve(null);
        },
      );
      issueTxMock.ticket.findFirst.mockImplementation(
        (args: { where?: Record<string, unknown>; orderBy?: unknown }) => {
          const where = args?.where ?? {};
          if (where.externalRef && (where.externalRef as { not: null }).not === null) {
            return Promise.resolve(null);
          }
          if (where.visitId === visitId && args.orderBy) {
            return Promise.resolve({ displayNumber: 'A0002' });
          }
          return Promise.resolve(servingTicketRow);
        },
      );

      await expect(
        service.complete(orgId, step1TicketId, userId, '   ', 'workbench'),
      ).rejects.toThrow(/transaction number is required/i);
    });
  });

  describe('transfer() — move to next queue in journey', () => {
    beforeEach(() => {
      mockPrisma.withTenant.mockImplementation(
        async (_org: string, cb: (tx: unknown) => Promise<unknown>) =>
          cb(buildTransferTxMock('R-on-step-1') as never),
      );
    });

    it('copies receipt from step 1 when transfer omits externalRef', async () => {
      await service.transfer(
        orgId,
        step1TicketId,
        'q-pickup',
        userId,
        undefined,
        undefined,
        'workbench',
      );

      expect(transferCreatePayload).toMatchObject({
        visitId,
        queueId: 'q-pickup',
        externalRef: 'R-on-step-1',
      });
      expect(transferCompleteUpdatePayload?.externalRef).toBe('R-on-step-1');
    });

    it('uses explicit externalRef on transfer over the source ticket value', async () => {
      await service.transfer(
        orgId,
        step1TicketId,
        'q-pickup',
        userId,
        undefined,
        'R-transfer-99',
        'workbench',
      );

      expect(transferCreatePayload).toMatchObject({ externalRef: 'R-transfer-99' });
    });

    it('requires receipt on transfer from step 1 when no saved ref exists', async () => {
      mockPrisma.withTenant.mockImplementation(
        async (_org: string, cb: (tx: unknown) => Promise<unknown>) =>
          cb(buildTransferTxMock(null) as never),
      );

      await expect(
        service.transfer(
          orgId,
          step1TicketId,
          'q-pickup',
          userId,
          undefined,
          undefined,
          'workbench',
        ),
      ).rejects.toThrow(/transaction number is required/i);
    });
  });

  describe('issueTicket() — new step in visit', () => {
    it('inherits externalRef from a sibling ticket in the same visit', async () => {
      const txMock = buildIssueTxMock();
      mockPrisma.withTenant.mockImplementation(
        async (_org: string, cb: (tx: unknown) => Promise<unknown>) => cb(txMock as never),
      );

      await service.issueTicket(
        orgId,
        {
          branchId: 'branch-1',
          queueId: 'q-pickup',
          serviceId: 'svc-pickup',
          visitId,
          source: 'staff',
          externalRef: undefined,
        },
        'authenticated',
      );

      expect(txMock.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ externalRef: 'R-from-sibling' }),
        }),
      );
    });

    it('uses explicit externalRef on issue without overwriting from sibling', async () => {
      const txMock = buildIssueTxMock();
      mockPrisma.withTenant.mockImplementation(
        async (_org: string, cb: (tx: unknown) => Promise<unknown>) => cb(txMock as never),
      );

      await service.issueTicket(
        orgId,
        {
          branchId: 'branch-1',
          queueId: 'q-pickup',
          serviceId: 'svc-pickup',
          visitId,
          source: 'staff',
          externalRef: 'R-explicit',
        },
        'authenticated',
      );

      expect(txMock.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ externalRef: 'R-explicit' }),
        }),
      );
    });
  });
});
