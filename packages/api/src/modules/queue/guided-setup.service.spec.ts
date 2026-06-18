import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuidedSetupService } from './guided-setup.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

vi.mock('../../common/rbac/org-owner.util', () => ({
  userIsOrganizationOwnerOrAdmin: vi.fn(),
}));

import { userIsOrganizationOwnerOrAdmin } from '../../common/rbac/org-owner.util';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (_orgId, cb) => cb(mockPrisma)),
  branch: { findFirst: vi.fn() },
  queue: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  service: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  branchService: { create: vi.fn() },
  roleAssignment: { findMany: vi.fn() },
  branchFlowTemplate: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  desk: { findMany: vi.fn() },
};

const mockPlanLimits = {
  checkLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, limitReached: false, limit: 100, current: 0 }),
};

const mockStationProfileService = {
  repairJourneyProfilesForFlowTemplate: vi.fn().mockResolvedValue(undefined),
  provisionJourneyStationProfiles: vi.fn().mockResolvedValue('station-profile-1'),
};

describe('GuidedSetupService', () => {
  let service: GuidedSetupService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    vi.mocked(userIsOrganizationOwnerOrAdmin).mockResolvedValue(true);
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
    mockPrisma.queue.count.mockResolvedValue(0);
    mockPrisma.queue.findFirst.mockResolvedValue(null);
    mockPrisma.service.findMany.mockResolvedValue([
      {
        id: 'svc-new',
        branchServices: [{ branchId: 'branch-a', isActive: true }],
      },
    ]);
    mockPrisma.service.findFirst.mockImplementation(
      (args: { select?: { durationMinutes?: boolean } }) => {
        if (args?.select?.durationMinutes) {
          return Promise.resolve({ durationMinutes: 15 });
        }
        return Promise.resolve(null);
      },
    );
    mockPrisma.service.create.mockResolvedValue({
      id: 'svc-new',
      durationMinutes: 15,
    });
    mockPrisma.queue.create.mockResolvedValue({ id: 'queue-new' });
    service = new GuidedSetupService(
      mockPrisma as never,
      mockPlanLimits as never,
      mockStationProfileService as never,
    );
  });

  it('rejects non-owner/admin actors', async () => {
    vi.mocked(userIsOrganizationOwnerOrAdmin).mockResolvedValue(false);

    await expect(
      service.deploy('org-1', 'user-staff', {
        flowType: 'single',
        branchId: 'branch-a',
        service: {
          mode: 'new',
          name: 'Walk-in',
          durationMinutes: 15,
          serviceEstimateLowMinutes: 5,
          serviceEstimateHighMinutes: 15,
        },
        queue: {
          mode: 'new',
          name: 'General',
          prefix: 'G',
          callingPolicy: 'fifo',
        },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects single deploy when both service and queue are existing', async () => {
    await expect(
      service.deploy('org-1', 'user-owner', {
        flowType: 'single',
        branchId: 'branch-a',
        service: { mode: 'existing', serviceId: 'svc-1' },
        queue: { mode: 'existing', queueId: 'queue-1' },
      }),
    ).rejects.toThrow(/at least one new service or queue/i);
  });

  it('deploys a single-step journey with new service and queue', async () => {
    const result = await service.deploy('org-1', 'user-owner', {
      flowType: 'single',
      branchId: 'branch-a',
      service: {
        mode: 'new',
        name: 'Walk-in Support',
        durationMinutes: 15,
        serviceEstimateLowMinutes: 5,
        serviceEstimateHighMinutes: 15,
      },
      queue: {
        mode: 'new',
        name: 'General Queue',
        prefix: 'G',
        callingPolicy: 'fifo',
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      flowType: 'single',
      serviceId: 'svc-new',
      queueId: 'queue-new',
    });
    expect(mockPrisma.service.create).toHaveBeenCalled();
    expect(mockPrisma.queue.create).toHaveBeenCalled();
  });

  it('rejects multi deploy when duplicate prefixes are used in new queues', async () => {
    await expect(
      service.deploy('org-1', 'user-owner', {
        flowType: 'multi',
        branchId: 'branch-a',
        templateName: 'Visit flow',
        autoActivate: false,
        service: {
          mode: 'new',
          name: 'Visit',
          durationMinutes: 20,
          serviceEstimateLowMinutes: 10,
          serviceEstimateHighMinutes: 20,
        },
        steps: [
          {
            deskNumber: '1',
            stepRole: 'service',
            callingPolicy: 'fifo',
            queue: { mode: 'new', name: 'Reception', prefix: 'R' },
          },
          {
            deskNumber: '2',
            stepRole: 'pickup',
            callingPolicy: 'ready_then_manual',
            queue: { mode: 'new', name: 'Pickup', prefix: 'R' },
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('deploys a multi-step journey in one transaction', async () => {
    mockPrisma.desk.findMany.mockResolvedValue([{ number: '1' }, { number: '2' }]);
    mockPrisma.queue.findMany.mockImplementation(
      ({ where }: { where?: { id?: { in?: string[] } } }) => {
        const ids = where?.id?.in ?? [];
        return Promise.resolve(
          ids.map((id, index) => ({
            id,
            branchId: 'branch-a',
            serviceId: 'svc-new',
            journeyModeOverride: 'visit_multi_step',
            name: `Queue ${index + 1}`,
            flowTemplateId: null,
          })),
        );
      },
    );
    mockPrisma.queue.create
      .mockResolvedValueOnce({ id: 'queue-1' })
      .mockResolvedValueOnce({ id: 'queue-2' });
    mockPrisma.branchFlowTemplate.create.mockResolvedValue({
      id: 'tpl-1',
      steps: [{ serviceId: 'svc-new' }],
    });
    mockPrisma.branchFlowTemplate.update.mockResolvedValue({});
    mockPrisma.branchFlowTemplate.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.queue.update.mockResolvedValue({});
    mockPrisma.queue.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.deploy('org-1', 'user-owner', {
      flowType: 'multi',
      branchId: 'branch-a',
      templateName: 'Visit Flow',
      autoActivate: false,
      service: {
        mode: 'new',
        name: 'Visit',
        durationMinutes: 20,
        serviceEstimateLowMinutes: 10,
        serviceEstimateHighMinutes: 20,
      },
      steps: [
        {
          deskNumber: '1',
          stepRole: 'service',
          callingPolicy: 'fifo',
          queue: { mode: 'new', name: 'Reception', prefix: 'R' },
        },
        {
          deskNumber: '2',
          stepRole: 'pickup',
          callingPolicy: 'ready_then_manual',
          queue: { mode: 'new', name: 'Pickup', prefix: 'P' },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      flowType: 'multi',
      templateId: 'tpl-1',
      activated: false,
    });
    expect(mockPrisma.withTenant).toHaveBeenCalled();
    expect(mockPrisma.queue.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.branchFlowTemplate.create).toHaveBeenCalledTimes(1);
    expect(mockStationProfileService.provisionJourneyStationProfiles).not.toHaveBeenCalled();
  });

  it('returns not found when branch does not exist', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      service.deploy('org-1', 'user-owner', {
        flowType: 'single',
        branchId: 'missing-branch',
        service: {
          mode: 'new',
          name: 'Walk-in',
          durationMinutes: 15,
          serviceEstimateLowMinutes: 5,
          serviceEstimateHighMinutes: 15,
        },
        queue: {
          mode: 'new',
          name: 'General',
          prefix: 'G',
          callingPolicy: 'fifo',
        },
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
