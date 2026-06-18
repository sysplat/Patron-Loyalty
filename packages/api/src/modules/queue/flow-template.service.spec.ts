import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowTemplateService } from './flow-template.service';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  branchFlowTemplate: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  branchFlowStep: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  desk: { findMany: vi.fn() },
  branch: { findFirst: vi.fn() },
  queue: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  service: { findMany: vi.fn() },
  roleAssignment: { findMany: vi.fn() },
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
};

const mockStationProfileService = {
  provisionJourneyStationProfiles: vi.fn().mockResolvedValue(null),
  repairJourneyProfilesForFlowTemplate: vi.fn().mockResolvedValue(undefined),
};

describe('FlowTemplateService', () => {
  let service: FlowTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.roleAssignment.findMany = vi
      .fn()
      .mockResolvedValue([{ role: { name: 'owner' }, branchId: null }]);
    mockPrisma.desk.findMany.mockResolvedValue([
      { number: '1', status: 'open' },
      { number: '2', status: 'open' },
    ]);
    service = new FlowTemplateService(mockPrisma as any, mockStationProfileService as any);
  });

  describe('create — assertStepQueueScope', () => {
    it('rejects non owner/admin actors', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        { role: { name: 'staff' }, branchId: 'branch-a' },
      ]);

      await expect(service.list('org-1', 'user-2', 'branch-a')).rejects.toThrow(
        /owners, admins, and branch managers/i,
      );
    });

    it('allows branch-scoped manager actors for their branch', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        { role: { name: 'manager' }, branchId: 'branch-a' },
      ]);
      mockPrisma.branchFlowTemplate.findMany.mockResolvedValue([]);

      const result = await service.list('org-1', 'user-2', 'branch-a');
      expect(result).toEqual([]);
    });

    it('rejects branch-scoped manager actors for other branches', async () => {
      mockPrisma.roleAssignment.findMany.mockResolvedValue([
        { role: { name: 'manager' }, branchId: 'branch-b' },
      ]);

      await expect(service.list('org-1', 'user-2', 'branch-a')).rejects.toThrow(
        /assigned to them/i,
      );
    });

    it('rejects services not assigned to the template branch', async () => {
      mockPrisma.withTenant.mockImplementation(
        async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      mockPrisma.queue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          branchId: 'branch-a',
          serviceId: 'svc-wrong',
          journeyModeOverride: 'visit_multi_step',
          name: 'Step queue',
        },
      ]);
      mockPrisma.service.findMany.mockResolvedValue([
        {
          id: 'svc-wrong',
          name: 'Other branch service',
          branchServices: [{ branchId: 'branch-b', isActive: true }],
        },
      ]);

      await expect(
        service.create('org-1', 'user-1', {
          branchId: 'branch-a',
          name: 'Test flow',
          steps: [
            {
              stepIndex: 1,
              deskNumber: '1',
              serviceId: 'svc-wrong',
              queueId: 'queue-1',
              stepRole: 'service',
              callingPolicy: 'fifo',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects pickup as the first flow step', async () => {
      mockPrisma.queue.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          branchId: 'branch-a',
          serviceId: 'svc-1',
          journeyModeOverride: 'visit_multi_step',
          name: 'Step queue',
        },
      ]);
      mockPrisma.service.findMany.mockResolvedValue([
        {
          id: 'svc-1',
          name: 'Service 1',
          branchServices: [{ branchId: 'branch-a', isActive: true }],
        },
      ]);

      await expect(
        service.create('org-1', 'user-1', {
          branchId: 'branch-a',
          name: 'Invalid flow',
          steps: [
            {
              stepIndex: 1,
              deskNumber: '1',
              serviceId: 'svc-1',
              queueId: 'queue-1',
              stepRole: 'pickup',
              callingPolicy: 'ready_then_manual',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('activate', () => {
    it('returns activation summary and provisions journey profile', async () => {
      mockPrisma.branchFlowTemplate.findFirst.mockResolvedValueOnce({
        id: 'tpl-1',
        branchId: 'branch-a',
      });
      mockPrisma.withTenant.mockImplementation(
        async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.branchFlowStep.findMany.mockResolvedValue([
        {
          stepIndex: 1,
          deskNumber: '1',
          serviceId: 'svc-1',
          queueId: 'queue-1',
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
        {
          stepIndex: 2,
          deskNumber: '2',
          serviceId: 'svc-2',
          queueId: 'queue-2',
          stepRole: 'pickup',
          callingPolicy: 'ready_then_manual',
        },
      ]);
      mockPrisma.branchFlowTemplate.findMany.mockResolvedValue([]);
      mockPrisma.queue.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.queue.update.mockResolvedValue({});
      mockPrisma.branchFlowTemplate.update.mockResolvedValue({
        id: 'tpl-1',
        branchId: 'branch-a',
        steps: [{ queueId: 'queue-1' }, { queueId: 'queue-2' }],
      });
      mockStationProfileService.provisionJourneyStationProfiles.mockResolvedValue(
        'station-profile-1',
      );

      const result = await service.activate('org-1', 'user-1', 'tpl-1', 'user-1');

      expect(result.activationSummary).toEqual({
        queueIds: ['queue-1', 'queue-2'],
        stepCount: 2,
        stationProfileId: 'station-profile-1',
      });
      expect(mockStationProfileService.provisionJourneyStationProfiles).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        'branch-a',
      );
    });

    it('throws BadRequestException if there is a queue overlap with another active template', async () => {
      mockPrisma.branchFlowTemplate.findFirst.mockResolvedValueOnce({
        id: 'tpl-1',
        branchId: 'branch-a',
      });
      mockPrisma.withTenant.mockImplementation(
        async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.branchFlowStep.findMany.mockResolvedValue([
        {
          stepIndex: 1,
          deskNumber: '1',
          serviceId: 'svc-1',
          queueId: 'queue-1',
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
      ]);
      mockPrisma.branchFlowTemplate.findMany.mockResolvedValue([
        {
          id: 'tpl-2',
          steps: [{ queueId: 'queue-1' }],
        },
      ]);

      await expect(service.activate('org-1', 'user-1', 'tpl-1', 'user-1')).rejects.toThrow(
        /one or more queues are already used/i,
      );
    });
  });

  describe('deactivate', () => {
    it('deactivates template and unlinks queues', async () => {
      mockPrisma.branchFlowTemplate.findFirst.mockResolvedValueOnce({
        id: 'tpl-1',
        branchId: 'branch-a',
      });
      mockPrisma.withTenant.mockImplementation(
        async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.queue.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.branchFlowTemplate.update.mockResolvedValue({
        id: 'tpl-1',
        branchId: 'branch-a',
        isActive: false,
      });

      const result = await service.deactivate('org-1', 'user-1', 'tpl-1');

      expect(result).toMatchObject({ isActive: false });
      expect(mockPrisma.queue.updateMany).toHaveBeenCalledWith({
        where: { orgId: 'org-1', branchId: 'branch-a', flowTemplateId: 'tpl-1' },
        data: { flowTemplateId: null },
      });
      expect(mockPrisma.branchFlowTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tpl-1' },
          data: { isActive: false },
        }),
      );
      expect(mockStationProfileService.repairJourneyProfilesForFlowTemplate).toHaveBeenCalledWith(
        'org-1',
        'tpl-1',
      );
    });
  });
});
