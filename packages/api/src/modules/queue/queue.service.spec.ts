import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueService } from './queue.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

vi.mock('../../common/resolve-effective-timezone', () => ({
  resolveEffectiveIanaZone: vi.fn().mockResolvedValue('America/Vancouver'),
  resolveBranchIanaZone: vi.fn().mockResolvedValue('America/Vancouver'),
}));

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  queue: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  branch: { findFirst: vi.fn(), findUnique: vi.fn() },
  setting: { findFirst: vi.fn() },
  branchFlowTemplate: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  branchFlowStep: { findMany: vi.fn() },
  service: { findFirst: vi.fn() },
  ticket: { count: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
  organization: {
    findUnique: vi.fn().mockResolvedValue({
      name: 'Test Org',
      logoUrl: null,
      website: 'https://example.com',
      country: 'CA',
      industry: 'healthcare',
      timezone: 'UTC',
    }),
  },
  role: { findFirst: vi.fn() },
  roleAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
};

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  getJson: vi.fn(),
  mgetJson: vi.fn().mockResolvedValue([]),
};

const mockPlanLimits = {
  checkLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, limitReached: false, limit: 100, current: 0 }),
  getLimits: vi.fn().mockResolvedValue({ hasCrmIntegration: true }),
};

const mockPatronCrmFeature = {
  isEnabled: vi.fn().mockResolvedValue(false),
};

const mockRealtime = {
  publish: vi.fn().mockResolvedValue(undefined),
};

const mockConfig = {
  get: vi.fn(),
};

const mockTicketService = {
  closePriorSessionWaitingTickets: vi.fn().mockResolvedValue({ closed: 0, dryRun: false }),
};

const mockBranchHours = {
  assertBranchAcceptsCustomerIntake: vi.fn().mockResolvedValue(undefined),
};

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    mockPrisma.queue.findFirst.mockResolvedValue({
      id: 'queue-1',
      orgId: 'org-1',
      status: 'open',
      flowTemplateId: null,
      branchId: 'branch-1',
      serviceId: 'service-1',
      callingPolicy: 'fifo',
      stepRole: null,
      journeyModeOverride: 'single_ticket',
      branch: {},
      service: {},
      queueRules: [],
      tickets: [],
    });
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockPrisma.queue.update.mockResolvedValue({ id: 'queue-1', status: 'closed' });
    mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-owner' });
    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      {
        branchId: null,
        role: {
          isSystemRole: true,
          name: 'admin',
          rolePermissions: [
            {
              permission: {
                resource: 'queue',
                action: 'manage',
                scope: 'org',
              },
            },
          ],
        },
      },
    ]);
    mockPrisma.branchFlowStep.findMany.mockResolvedValue([]);
    mockPrisma.setting.findFirst.mockResolvedValue(null);

    mockConfig.get.mockImplementation((_k: string, d?: unknown) => d);
    service = new QueueService(
      mockPrisma as any,
      mockRedis as any,
      mockPlanLimits as any,
      mockPatronCrmFeature as any,
      mockRealtime as any,
      mockConfig as any,
      mockTicketService as any,
      mockBranchHours as any,
    );
  });

  describe('close', () => {
    it('allows admin forced close while customers are waiting', async () => {
      mockPrisma.ticket.count.mockResolvedValue(2);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: null,
          role: {
            isSystemRole: true,
            name: 'admin',
            rolePermissions: [
              {
                permission: {
                  resource: 'queue',
                  action: 'manage',
                  scope: 'org',
                },
              },
            ],
          },
        },
      ]);
      await service.close('org-1', 'queue-1', 'admin-user', {
        forceCloseWaiting: true,
        acknowledgeConsequences: true,
      });
      expect(mockPrisma.queue.update).toHaveBeenCalled();
    });

    it('blocks manager stop while customers are waiting', async () => {
      mockPrisma.ticket.count.mockResolvedValue(2);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: 'branch-1',
          role: {
            isSystemRole: true,
            name: 'manager',
            rolePermissions: [
              {
                permission: {
                  resource: 'queue',
                  action: 'manage',
                  scope: 'branch',
                },
              },
            ],
          },
        },
      ]);
      await expect(
        service.close('org-1', 'queue-1', 'manager-user', {
          forceCloseWaiting: true,
          acknowledgeConsequences: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin stop when no customers are waiting', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: null,
          role: {
            isSystemRole: true,
            name: 'admin',
            rolePermissions: [
              {
                permission: {
                  resource: 'queue',
                  action: 'manage',
                  scope: 'org',
                },
              },
            ],
          },
        },
      ]);
      await service.close('org-1', 'queue-1', 'admin-user');
      expect(mockPrisma.queue.update).toHaveBeenCalled();
    });

    it('allows manager stop when no customers are waiting', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: 'branch-1',
          role: {
            isSystemRole: true,
            name: 'manager',
            rolePermissions: [
              {
                permission: {
                  resource: 'queue',
                  action: 'manage',
                  scope: 'branch',
                },
              },
            ],
          },
        },
      ]);
      await service.close('org-1', 'queue-1', 'manager-user');
      expect(mockPrisma.queue.update).toHaveBeenCalled();
    });

    it('allows staff stop when no customers are waiting', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: 'branch-1',
          role: {
            isSystemRole: true,
            name: 'staff',
            rolePermissions: [
              {
                permission: {
                  resource: 'queue',
                  action: 'update',
                  scope: 'branch',
                },
              },
            ],
          },
        },
      ]);
      await service.close('org-1', 'queue-1', 'staff-user');
      expect(mockPrisma.queue.update).toHaveBeenCalled();
    });

    it('blocks viewer stop even when no customers are waiting', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: 'branch-1',
          role: {
            isSystemRole: true,
            name: 'viewer',
            rolePermissions: [],
          },
        },
      ]);
      await expect(service.close('org-1', 'queue-1', 'viewer-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('requires explicit owner force flags when waiting tickets exist', async () => {
      mockPrisma.ticket.count.mockResolvedValue(2);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: null,
          role: {
            isSystemRole: true,
            name: 'owner',
            rolePermissions: [],
          },
        },
      ]);

      await expect(
        service.close('org-1', 'queue-1', 'owner-user', {
          forceCloseWaiting: false,
          acknowledgeConsequences: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows owner forced close when waiting tickets exist', async () => {
      mockPrisma.ticket.count.mockResolvedValue(2);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: null,
          role: {
            isSystemRole: true,
            name: 'owner',
            rolePermissions: [],
          },
        },
      ]);

      await service.close('org-1', 'queue-1', 'owner-user', {
        forceCloseWaiting: true,
        acknowledgeConsequences: true,
      });

      expect(mockPrisma.queue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: {
          status: 'closed',
          nextTicketSeq: 1,
          sessionOpenedAt: null,
          sessionClosesAt: null,
        },
        include: { branch: true },
      });
    });

    it('allows owner close when no waiting tickets exist', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        {
          branchId: null,
          role: {
            isSystemRole: true,
            name: 'owner',
            rolePermissions: [],
          },
        },
      ]);

      await service.close('org-1', 'queue-1', 'owner-user');

      expect(mockPrisma.queue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: {
          status: 'closed',
          nextTicketSeq: 1,
          sessionOpenedAt: null,
          sessionClosesAt: null,
        },
        include: { branch: true },
      });
    });
  });

  describe('getPublicQueues', () => {
    it('throws when branch does not exist', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);

      await expect(service.getPublicQueues('missing-branch')).rejects.toThrow(NotFoundException);
    });

    it('omits later-step queues from an active multi-step flow', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ orgId: 'org-1' });
      mockPrisma.branchFlowTemplate.findMany.mockResolvedValue([
        {
          steps: [
            { stepIndex: 1, queueId: 'q-reception', serviceId: 's-entry' },
            { stepIndex: 2, queueId: 'q-prep', serviceId: 's-prep' },
          ],
        },
      ]);
      mockPrisma.queue.findMany.mockResolvedValue([
        {
          id: 'q-order',
          name: 'Order Queue',
          prefix: 'O',
          status: 'open',
          service: { id: 'svc-1', name: 'Ordering', description: null },
          _count: { tickets: 0 },
        },
      ]);
      mockRedis.getJson.mockResolvedValue(null);

      const result = await service.getPublicQueues('branch-a');

      expect(mockPrisma.queue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branchId: 'branch-a',
            status: 'open',
            id: { notIn: ['q-prep'] },
          }),
        }),
      );
      expect(result.queues).toHaveLength(1);
      expect(result.queues[0].id).toBe('q-order');
      expect(result.showWaitEstimates).toBe(false);
      expect(result.meta.kioskNameRequired).toBe(false);
    });

    it('hides standalone queues that share the entry service on a multi-step flow', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ orgId: 'org-1' });
      mockPrisma.branchFlowTemplate.findMany.mockResolvedValue([
        {
          steps: [
            { stepIndex: 1, queueId: 'q-reception', serviceId: 's-shared' },
            { stepIndex: 2, queueId: 'q-prep', serviceId: 's-prep' },
          ],
        },
      ]);
      mockPrisma.queue.findMany.mockResolvedValue([
        {
          id: 'q-reception',
          name: 'Phone Demo • Reception',
          prefix: 'PD1',
          status: 'open',
          service: { id: 'svc-general', name: 'General Consultation', description: null },
          _count: { tickets: 1 },
        },
        {
          id: 'q-main',
          name: 'Main Lounge',
          prefix: 'C',
          status: 'open',
          service: { id: 'svc-general', name: 'General Consultation', description: null },
          _count: { tickets: 5 },
        },
        {
          id: 'q-pharmacy',
          name: 'Pharmacy Window',
          prefix: 'P',
          status: 'open',
          service: { id: 'svc-pharmacy', name: 'Pharmacy', description: null },
          _count: { tickets: 3 },
        },
      ]);
      mockRedis.getJson.mockResolvedValue(null);

      const result = await service.getPublicQueues('branch-a');

      expect(result.queues.map((q) => q.id)).toEqual(['q-reception', 'q-pharmacy']);
      expect(result.showWaitEstimates).toBe(false);
    });

    it('returns all open queues when no active flow template exists', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ orgId: 'org-1' });
      mockPrisma.branchFlowTemplate.findMany.mockResolvedValue([]);
      mockPrisma.queue.findMany.mockResolvedValue([
        {
          id: 'q-standalone',
          name: 'Walk-in',
          prefix: 'W',
          status: 'open',
          service: { id: 'svc-1', name: 'General', description: null },
          _count: { tickets: 0 },
        },
      ]);
      mockRedis.getJson.mockResolvedValue(null);

      const result = await service.getPublicQueues('branch-a');

      expect(mockPrisma.queue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-a', status: 'open' }),
        }),
      );
      expect(result.queues).toHaveLength(1);
      expect(result.showWaitEstimates).toBe(true);
    });
  });

  describe('surface filtering', () => {
    it('returns only classic queues when surface=classic and read filter enabled', async () => {
      mockConfig.get.mockImplementation((key: string, d?: unknown) => {
        if (key === 'app.surfaceIsolation.readFilter') return true;
        return d;
      });
      mockPrisma.queue.findMany.mockResolvedValue([
        {
          id: 'q-classic',
          branchId: 'branch-1',
          journeyModeOverride: 'single_ticket',
          flowTemplateId: null,
          branch: { id: 'b1', name: 'Main' },
          service: { id: 's1', name: 'Service' },
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
        {
          id: 'q-journey',
          branchId: 'branch-1',
          journeyModeOverride: 'visit_multi_step',
          flowTemplateId: 'tpl-1',
          branch: { id: 'b1', name: 'Main' },
          service: { id: 's1', name: 'Service' },
          stepRole: 'pickup',
          callingPolicy: 'ready_then_manual',
        },
      ]);
      mockPrisma.ticket.groupBy.mockResolvedValue([{ queueId: 'q-classic', _count: { _all: 2 } }]);

      const result = await service.list('org-1', 'branch-1', undefined, null, 'classic');
      expect(result.map((q) => q.id)).toEqual(['q-classic']);
      expect(result[0].waitingCount).toBe(2);
      expect(mockTicketService.closePriorSessionWaitingTickets).toHaveBeenCalledWith({
        orgId: 'org-1',
      });
    });

    it('bypasses surface filtering when feature flag is disabled', async () => {
      mockConfig.get.mockImplementation((key: string, d?: unknown) => {
        if (key === 'app.surfaceIsolation.readFilter') return false;
        return d;
      });
      mockPrisma.queue.findMany.mockResolvedValue([
        {
          id: 'q-classic',
          branchId: 'branch-1',
          journeyModeOverride: 'single_ticket',
          flowTemplateId: null,
          branch: { id: 'b1', name: 'Main' },
          service: { id: 's1', name: 'Service' },
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
        {
          id: 'q-journey',
          branchId: 'branch-1',
          journeyModeOverride: 'visit_multi_step',
          flowTemplateId: 'tpl-1',
          branch: { id: 'b1', name: 'Main' },
          service: { id: 's1', name: 'Service' },
          stepRole: 'pickup',
          callingPolicy: 'ready_then_manual',
        },
      ]);
      mockPrisma.ticket.groupBy.mockResolvedValue([{ queueId: 'q-classic', _count: { _all: 2 } }]);

      const result = await service.list('org-1', 'branch-1', undefined, null, 'classic');
      expect(result.map((q) => q.id)).toEqual(['q-classic', 'q-journey']);
    });
  });

  describe('update', () => {
    it('rejects lifecycle field edits via PATCH payload', async () => {
      await expect(
        service.update('org-1', 'queue-1', {
          status: 'closed',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.queue.update).not.toHaveBeenCalled();
    });

    it('rejects direct policy edits for flow-managed queues', async () => {
      mockPrisma.queue.findFirst.mockResolvedValueOnce({
        id: 'queue-1',
        orgId: 'org-1',
        status: 'open',
        flowTemplateId: 'tpl-1',
        branchId: 'branch-1',
        serviceId: 'service-1',
        callingPolicy: 'fifo',
        stepRole: 'service',
        journeyModeOverride: 'visit_multi_step',
        branch: {},
        service: {},
        queueRules: [],
        tickets: [],
      });

      await expect(
        service.update('org-1', 'queue-1', {
          callingPolicy: 'ready_then_manual',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates only whitelisted editable fields', async () => {
      mockPrisma.queue.update.mockResolvedValue({
        id: 'queue-1',
        name: 'Renamed Queue',
        prefix: 'RN',
        maxCapacity: 25,
      });

      await service.update('org-1', 'queue-1', {
        name: 'Renamed Queue',
        prefix: 'rn',
        maxCapacity: 25,
      });

      expect(mockPrisma.queue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: expect.objectContaining({
          name: 'Renamed Queue',
          prefix: 'RN',
          maxCapacity: 25,
          journeyModeOverride: 'single_ticket',
          stepRole: null,
          callingPolicy: 'fifo',
          flowTemplateId: null,
        }),
      });
    });
  });
});
