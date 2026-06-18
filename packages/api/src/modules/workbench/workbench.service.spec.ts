import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { WorkbenchService } from './workbench.service';
import { STATION_CAPABILITIES } from '@queueplatform/shared';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

const journeyProfile = {
  id: 'profile-journey',
  branchId: 'branch-1',
  name: 'Journey counter',
  primaryQueueId: 'q-order',
  flowTemplateId: 'tpl-1',
  queues: [
    {
      queueId: 'q-order',
      queue: { name: 'Order', stepRole: 'service' },
      visibilityOnly: false,
      capabilities: [
        STATION_CAPABILITIES.CALL,
        STATION_CAPABILITIES.SERVE,
        STATION_CAPABILITIES.COMPLETE,
        STATION_CAPABILITIES.NO_SHOW,
      ],
    },
    {
      queueId: 'q-pickup',
      queue: { name: 'Pickup', stepRole: 'pickup' },
      visibilityOnly: false,
      capabilities: [STATION_CAPABILITIES.MARK_READY, STATION_CAPABILITIES.CALL],
    },
  ],
};

function activePickupTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-pickup-1',
    visitId: 'visit-1',
    displayNumber: 'A0002',
    queueId: 'q-pickup',
    status: 'waiting',
    readyAt: null,
    customerName: 'Jane',
    customerPhone: '+15551234567',
    deskNumber: null,
    bookedAt: new Date('2026-05-18T11:00:00Z'),
    priority: 0,
    externalRef: null,
    stepIndex: 2,
    queue: { id: 'q-pickup', name: 'Pickup', stepRole: 'pickup' },
    service: { id: 'svc-pickup', name: 'Pickup' },
    ...overrides,
  };
}

describe('WorkbenchService', () => {
  let service: WorkbenchService;

  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
    branch: { findFirst: vi.fn() },
    desk: { findFirst: vi.fn().mockResolvedValue(null) },
    stationProfile: { findFirst: vi.fn() },
    visit: { findMany: vi.fn().mockResolvedValue([]) },
    ticket: { findMany: vi.fn() },
    queue: { findMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
    branchFlowStep: { findMany: vi.fn() },
    branchFlowTemplate: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }) },
    agentSession: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    roleAssignment: {
      findMany: vi.fn().mockResolvedValue([{ role: { name: 'owner' } }]),
    },
  };

  const mockRedis = { get: vi.fn(), set: vi.fn() };
  const mockStationProfileService = {
    getById: vi.fn(),
    resolveJourneyProfileForBranch: vi.fn(),
    resolveDefaultProfileForBranch: vi.fn(),
    provisionJourneyStationProfiles: vi.fn(),
    repairJourneyProfileQueues: vi.fn(),
  };
  const mockAgentSessionService = {
    getActive: vi.fn(),
    start: vi.fn(),
    heartbeat: vi.fn(),
    syncSessionForWorkbench: vi.fn(),
  };
  const mockJourneyDeskAssignmentGuard = {
    assertMayUseJourneyDesk: vi.fn(async (_o: string, _u: string, _b: string, desk: string) => {
      const digits = String(desk).replace(/\D/g, '');
      return digits || '1';
    }),
    assertMayActOnJourneyQueue: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    service = new WorkbenchService(
      mockPrisma as any,
      mockRedis as any,
      mockStationProfileService as any,
      mockAgentSessionService as any,
      mockJourneyDeskAssignmentGuard as any,
    );
  });

  describe('assertCapability', () => {
    it('throws when queue is visibility-only', () => {
      expect(() =>
        service.assertCapability(
          [
            {
              queueId: 'q1',
              visibilityOnly: true,
              capabilities: [STATION_CAPABILITIES.MARK_READY],
            },
          ],
          'q1',
          STATION_CAPABILITIES.MARK_READY,
        ),
      ).toThrow(BadRequestException);
    });

    it('throws when capability missing', () => {
      expect(() =>
        service.assertCapability(
          [
            {
              queueId: 'q1',
              visibilityOnly: false,
              capabilities: [STATION_CAPABILITIES.CALL],
            },
          ],
          'q1',
          STATION_CAPABILITIES.MARK_READY,
        ),
      ).toThrow(BadRequestException);
    });

    it('passes when capability present', () => {
      expect(() =>
        service.assertCapability(
          [
            {
              queueId: 'q1',
              visibilityOnly: false,
              capabilities: [STATION_CAPABILITIES.MARK_READY],
            },
          ],
          'q1',
          STATION_CAPABILITIES.MARK_READY,
        ),
      ).not.toThrow();
    });
  });

  describe('branchNeedsWorkbench', () => {
    it('returns false when no active flow', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ name: 'Main' });
      mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue(null);
      await expect(service.branchNeedsWorkbench('org', 'branch')).resolves.toBe(false);
    });

    it('returns true when active flow has 2+ steps', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ name: 'Main' });
      mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
        name: 'Phone Demo',
        steps: [
          {
            stepIndex: 1,
            deskNumber: '1',
            stepRole: 'service',
            queueId: 'q1',
            queue: { id: 'q1', name: 'Reception' },
          },
          {
            stepIndex: 2,
            deskNumber: '2',
            stepRole: 'pickup',
            queueId: 'q2',
            queue: { id: 'q2', name: 'Pickup' },
          },
        ],
      });
      await expect(service.branchNeedsWorkbench('org', 'branch')).resolves.toBe(true);
    });
  });

  describe('getBranchServeContext', () => {
    it('returns multi-step summary when flow has 2+ queues', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ name: 'Downtown' });
      mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
        name: 'Phone Demo',
        steps: [
          {
            stepIndex: 1,
            deskNumber: '1',
            stepRole: 'service',
            queueId: 'q1',
            queue: { id: 'q1', name: 'Reception' },
          },
          {
            stepIndex: 2,
            deskNumber: '2',
            stepRole: 'pickup',
            queueId: 'q2',
            queue: { id: 'q2', name: 'Pickup' },
          },
        ],
      });
      mockPrisma.queue.findMany.mockResolvedValue([
        { id: 'q1', journeyModeOverride: 'visit_multi_step', flowTemplateId: 'tpl-1' },
        { id: 'q2', journeyModeOverride: 'visit_multi_step', flowTemplateId: 'tpl-1' },
        { id: 'q3', journeyModeOverride: 'single_ticket', flowTemplateId: null },
      ]);
      await expect(service.getBranchServeContext('org', 'branch')).resolves.toMatchObject({
        needsWorkbench: true,
        mode: 'multi_step',
        branchName: 'Downtown',
        flowName: 'Phone Demo',
        journeySummary: 'Reception → Pickup',
        multiStepQueueIds: ['q1', 'q2'],
        singleStepQueueIds: ['q3'],
      });
    });
  });

  describe('getWorkbench — visit receipt (externalRef) for step 2', () => {
    const session = {
      id: 'session-1',
      branchId: 'branch-1',
      deskId: null,
      deskNumber: '1',
      stationProfileId: 'profile-journey',
    };

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockStationProfileService.resolveJourneyProfileForBranch.mockResolvedValue('profile-journey');
      mockStationProfileService.getById.mockResolvedValue(journeyProfile);
      mockAgentSessionService.syncSessionForWorkbench.mockResolvedValue(session);
      mockPrisma.visit.findMany.mockResolvedValue([]);
      mockPrisma.queue.findMany.mockResolvedValue([
        { id: 'q-order', callingPolicy: 'fifo', stepRole: 'service', flowTemplateId: 'tpl-1' },
        {
          id: 'q-pickup',
          callingPolicy: 'ready_then_fifo',
          stepRole: 'pickup',
          flowTemplateId: 'tpl-1',
        },
      ]);
      mockPrisma.branchFlowStep.findMany.mockResolvedValue([
        { queueId: 'q-order', stepRole: 'service', callingPolicy: 'fifo', templateId: 'tpl-1' },
        {
          queueId: 'q-pickup',
          stepRole: 'pickup',
          callingPolicy: 'ready_then_fifo',
          templateId: 'tpl-1',
        },
      ]);
    });

    it('surfaces receipt on step-2 row when ticket has no externalRef but visit does', async () => {
      mockPrisma.visit.findMany.mockResolvedValue([{ id: 'visit-1', externalRef: 'R-883' }]);
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([activePickupTicket()]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const pickupLane = result.lanes.find((l) => l.queueId === 'q-pickup');
      expect(pickupLane?.items).toHaveLength(1);
      expect(pickupLane?.items[0]).toMatchObject({
        displayNumber: 'A0002',
        externalRef: 'R-883',
      });
    });

    it('keeps receipt already stored on the step-2 ticket', async () => {
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([activePickupTicket({ externalRef: 'R-on-ticket' })]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const item = result.lanes.find((l) => l.queueId === 'q-pickup')?.items[0];
      expect(item?.externalRef).toBe('R-on-ticket');
    });

    it('returns null externalRef when visit has no receipt anywhere', async () => {
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([activePickupTicket()]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const item = result.lanes.find((l) => l.queueId === 'q-pickup')?.items[0];
      expect(item?.externalRef).toBeNull();
    });

    it('isolates receipts between two visits on the pickup lane', async () => {
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([
            activePickupTicket({ id: 't-a', visitId: 'visit-a', displayNumber: 'A0001' }),
            activePickupTicket({ id: 't-b', visitId: 'visit-b', displayNumber: 'A0002' }),
          ]);
        }
        if (args.where && 'externalRef' in args.where) {
          return Promise.resolve([
            {
              visitId: 'visit-a',
              externalRef: 'R-AAA',
              bookedAt: new Date('2026-05-18T10:00:00Z'),
            },
            {
              visitId: 'visit-b',
              externalRef: 'R-BBB',
              bookedAt: new Date('2026-05-18T10:05:00Z'),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const items = result.lanes.find((l) => l.queueId === 'q-pickup')?.items ?? [];
      const byVisit = Object.fromEntries(items.map((i) => [i.visitId, i.externalRef]));
      expect(byVisit).toEqual({
        'visit-a': 'R-AAA',
        'visit-b': 'R-BBB',
      });
    });

    it('uses the most recently booked receipt when visit has multiple historical refs', async () => {
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([activePickupTicket()]);
        }
        if (args.where && 'externalRef' in args.where) {
          return Promise.resolve([
            {
              visitId: 'visit-1',
              externalRef: 'R-newest',
              bookedAt: new Date('2026-05-18T12:00:00Z'),
            },
            {
              visitId: 'visit-1',
              externalRef: 'R-older',
              bookedAt: new Date('2026-05-18T09:00:00Z'),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const item = result.lanes.find((l) => l.queueId === 'q-pickup')?.items[0];
      expect(item?.externalRef).toBe('R-newest');
    });

    it('shows visit receipt on step-1 service lane when visit has a saved ref', async () => {
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([
            {
              id: 'ticket-order-1',
              visitId: 'visit-1',
              displayNumber: 'A0001',
              queueId: 'q-order',
              status: 'serving',
              readyAt: null,
              customerName: 'Jane',
              customerPhone: '+15551234567',
              deskNumber: '1',
              bookedAt: new Date('2026-05-18T10:00:00Z'),
              priority: 0,
              externalRef: null,
              stepIndex: 1,
              queue: { id: 'q-order', name: 'Order', stepRole: 'service' },
              service: { id: 'svc-order', name: 'Order' },
            },
          ]);
        }
        if (args.where && 'externalRef' in args.where) {
          return Promise.resolve([
            {
              visitId: 'visit-1',
              externalRef: 'R-883',
              bookedAt: new Date('2026-05-18T10:30:00Z'),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const orderLane = result.lanes.find((l) => l.queueId === 'q-order');
      expect(orderLane?.items[0]?.externalRef).toBe('R-883');
    });

    it('exposes mark_ready and call_specific on pickup items so staff can act before complete', async () => {
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([activePickupTicket()]);
        }
        if (args.where && 'externalRef' in args.where) {
          return Promise.resolve([
            { visitId: 'visit-1', externalRef: 'R-883', bookedAt: new Date() },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const item = result.lanes.find((l) => l.queueId === 'q-pickup')?.items[0];
      expect(item?.allowedActions).toEqual(expect.arrayContaining(['mark_ready']));
      expect(item?.allowedActions).not.toContain('prioritize');
      expect(item?.externalRef).toBe('R-883');
    });

    it('does not expose call_specific on ready_then_fifo pickup — staff use Call Next', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([
            activePickupTicket({ readyAt: new Date('2026-05-18T11:05:00Z') }),
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const item = result.lanes.find((l) => l.queueId === 'q-pickup')?.items[0];
      expect(item?.allowedActions).not.toContain('call_specific');
      expect(item?.allowedActions).not.toContain('prioritize');
    });

    it('exposes call_specific on ready_then_manual pickup when customer is ready', async () => {
      mockPrisma.queue.findMany.mockResolvedValue([
        { id: 'q-order', callingPolicy: 'fifo', stepRole: 'service', flowTemplateId: 'tpl-1' },
        {
          id: 'q-pickup',
          callingPolicy: 'ready_then_manual',
          stepRole: 'pickup',
          flowTemplateId: 'tpl-1',
        },
      ]);
      mockPrisma.branchFlowStep.findMany.mockResolvedValue([
        { queueId: 'q-order', stepRole: 'service', callingPolicy: 'fifo', templateId: 'tpl-1' },
        {
          queueId: 'q-pickup',
          stepRole: 'pickup',
          callingPolicy: 'ready_then_manual',
          templateId: 'tpl-1',
        },
      ]);
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([
            activePickupTicket({ readyAt: new Date('2026-05-18T11:05:00Z') }),
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const item = result.lanes.find((l) => l.queueId === 'q-pickup')?.items[0];
      expect(item?.allowedActions).toContain('call_specific');
      expect(item?.allowedActions).not.toContain('prioritize');
    });

    it('does not expose call_specific on fifo service lanes', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([
            {
              id: 'ticket-order-wait',
              visitId: 'visit-1',
              displayNumber: 'A0001',
              queueId: 'q-order',
              status: 'waiting',
              readyAt: null,
              customerName: 'Jane',
              customerPhone: '+15551234567',
              deskNumber: null,
              bookedAt: new Date('2026-05-18T10:00:00Z'),
              priority: 0,
              externalRef: null,
              stepIndex: 1,
              queue: { id: 'q-order', name: 'Order', stepRole: 'service' },
              service: { id: 'svc-order', name: 'Order' },
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const item = result.lanes.find((l) => l.queueId === 'q-order')?.items[0];
      expect(item?.allowedActions).not.toContain('call_specific');
    });

    it('exposes prioritize for non-manual calling policies (fifo single-step)', async () => {
      mockPrisma.queue.findMany.mockResolvedValue([
        {
          id: 'q-order',
          callingPolicy: 'fifo',
          stepRole: 'service',
          flowTemplateId: null,
        },
        {
          id: 'q-pickup',
          callingPolicy: 'ready_then_fifo',
          stepRole: 'pickup',
          flowTemplateId: null,
        },
      ]);
      mockPrisma.branchFlowStep.findMany.mockResolvedValue([]);
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([
            {
              ...activePickupTicket({
                id: 'ticket-order-1',
                queueId: 'q-order',
                queue: { id: 'q-order', name: 'Order', stepRole: 'service' },
                status: 'waiting',
                readyAt: null,
                stepIndex: null,
              }),
            },
            activePickupTicket(),
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const serviceItem = result.lanes.find((l) => l.queueId === 'q-order')?.items[0];
      const pickupItem = result.lanes.find((l) => l.queueId === 'q-pickup')?.items[0];

      expect(serviceItem?.allowedActions).toContain('prioritize');
      expect(pickupItem?.allowedActions).not.toContain('prioritize');
    });

    it('exposes no_show on called tickets so staff can mark absence without starting serve', async () => {
      mockPrisma.ticket.findMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
        if (args.where?.status) {
          return Promise.resolve([
            {
              id: 'ticket-order-called',
              visitId: 'visit-1',
              displayNumber: 'A0001',
              queueId: 'q-order',
              status: 'called',
              readyAt: null,
              customerName: 'Jane',
              customerPhone: '+15551234567',
              deskNumber: '1',
              bookedAt: new Date('2026-05-18T10:00:00Z'),
              priority: 0,
              externalRef: null,
              stepIndex: 1,
              queue: { id: 'q-order', name: 'Order', stepRole: 'service' },
              service: { id: 'svc-order', name: 'Order' },
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getWorkbench('org-1', 'user-1', {
        branchId: 'branch-1',
        deskNumber: '1',
        forJourney: true,
      });

      const item = result.lanes.find((l) => l.queueId === 'q-order')?.items[0];
      expect(item?.status).toBe('called');
      expect(item?.allowedActions).toEqual(expect.arrayContaining(['serve', 'no_show']));
      expect(item?.allowedActions).not.toContain('complete');
    });
  });
});
