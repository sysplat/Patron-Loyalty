import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { JourneyDeskAssignmentGuard } from './journey-desk-assignment.guard';

vi.mock('../../common/rbac/org-owner.util', () => ({
  userIsOrganizationSupervisor: vi.fn(),
}));

import { userIsOrganizationSupervisor } from '../../common/rbac/org-owner.util';

function mockDeskFindMany(assigned: Array<{ number: string }>, branch: Array<{ number: string }>) {
  return vi.fn((args: { where?: { assignedUsers?: unknown } }) => {
    if (args?.where?.assignedUsers) {
      return Promise.resolve(assigned);
    }
    return Promise.resolve(branch);
  });
}

describe('JourneyDeskAssignmentGuard', () => {
  const mockPrisma = {
    withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
    desk: { findMany: mockDeskFindMany([{ number: '1' }], [{ number: '1' }, { number: '2' }]) },
    branchFlowTemplate: { findFirst: vi.fn() },
    queue: { findFirst: vi.fn() },
    withTenant: vi.fn((orgId: string, cb: any) => cb(mockPrisma)),
  };

  const mockRedis = {
    getJson: vi.fn().mockResolvedValue(null),
    setJson: vi.fn().mockResolvedValue(undefined),
  };

  let guard: JourneyDeskAssignmentGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.getJson.mockResolvedValue(null);
    mockPrisma.desk.findMany = mockDeskFindMany(
      [{ number: '1' }],
      [{ number: '1' }, { number: '2' }],
    );
    guard = new JourneyDeskAssignmentGuard(mockPrisma as never, mockRedis as never);
    vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(false);
  });

  it('allows supervisor to use any counter', async () => {
    vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(true);
    await expect(guard.assertMayUseJourneyDesk('org', 'admin', 'branch', '3')).resolves.toBe('3');
    expect(mockPrisma.desk.findMany).not.toHaveBeenCalled();
  });

  it('rejects sign-in at non-assigned counter when user has assignments', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany(
      [{ number: '1' }],
      [{ number: '1' }, { number: '2' }],
    );
    await expect(guard.assertMayUseJourneyDesk('org', 'staff', 'branch', '2')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows sign-in at assigned counter', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany(
      [{ number: '1' }],
      [{ number: '1' }, { number: '2' }],
    );
    await expect(guard.assertMayUseJourneyDesk('org', 'staff', 'branch', '1')).resolves.toBe('1');
  });

  it('rejects sign-in when user has no branch desk assignments', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany([], [{ number: '1' }, { number: '2' }]);
    await expect(guard.assertMayUseJourneyDesk('org', 'staff', 'branch', '2')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects step actions when user has no branch desk assignments', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany([], [{ number: '1' }, { number: '2' }]);
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      steps: [
        { stepIndex: 0, deskNumber: '1', queueId: 'q-reception' },
        { stepIndex: 1, deskNumber: '2', queueId: 'q-lab' },
      ],
    });

    await expect(
      guard.assertMayActOnJourneyQueue('org', 'staff', 'branch', 'q-reception', '2'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects call-next on wrong step for assigned counter 1', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany(
      [{ number: '1' }],
      [{ number: '1' }, { number: '2' }],
    );
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      steps: [
        { stepIndex: 0, deskNumber: '1', queueId: 'q-reception' },
        { stepIndex: 1, deskNumber: '2', queueId: 'q-lab' },
      ],
    });

    await expect(
      guard.assertMayActOnJourneyQueue('org', 'staff', 'branch', 'q-lab', '1'),
    ).rejects.toThrow(/cannot perform actions on this step/i);
  });

  it('allows actions on matching step and counter', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany(
      [{ number: '2' }],
      [{ number: '1' }, { number: '2' }],
    );
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      steps: [
        { stepIndex: 0, deskNumber: '1', queueId: 'q-reception' },
        { stepIndex: 1, deskNumber: '2', queueId: 'q-lab' },
      ],
    });

    await expect(
      guard.assertMayActOnJourneyQueue('org', 'staff', 'branch', 'q-lab', '2'),
    ).resolves.toBeUndefined();
  });

  it('allows supervisor to act on any journey step regardless of signed-in counter', async () => {
    vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(true);
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      steps: [
        { stepIndex: 0, deskNumber: '1', queueId: 'q-reception' },
        { stepIndex: 1, deskNumber: '2', queueId: 'q-lab' },
      ],
    });

    await expect(
      guard.assertMayActOnJourneyQueue('org', 'owner', 'branch', 'q-reception', '2'),
    ).resolves.toBeUndefined();
  });

  it('resolveDeskForJourneyQueue uses the step counter, not the session desk', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany(
      [{ number: '1' }],
      [{ number: '1' }, { number: '2' }],
    );
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      steps: [
        { stepIndex: 0, deskNumber: '1', queueId: 'q-reception' },
        { stepIndex: 1, deskNumber: '2', queueId: 'q-lab' },
      ],
    });

    await expect(
      guard.resolveDeskForJourneyQueue('org', 'staff', 'branch', 'q-reception', '1'),
    ).resolves.toBe('1');
  });

  it('resolveDeskForJourneyQueue maps later steps to the last configured counter', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany(
      [{ number: '2' }],
      [{ number: '1' }, { number: '2' }],
    );
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      steps: [
        { stepIndex: 0, deskNumber: '1', queueId: 'q-reception' },
        { stepIndex: 1, deskNumber: '2', queueId: 'q-lab' },
        { stepIndex: 2, deskNumber: '2', queueId: 'q-pharmacy' },
      ],
    });

    await expect(
      guard.resolveDeskForJourneyQueue('org', 'staff', 'branch', 'q-pharmacy', '2'),
    ).resolves.toBe('2');
  });

  it('resolveDeskForJourneyQueue uses derived step counter for supervisors (non-blocking)', async () => {
    vi.mocked(userIsOrganizationSupervisor).mockResolvedValue(true);
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      steps: [
        { stepIndex: 0, deskNumber: '1', queueId: 'q-reception' },
        { stepIndex: 1, deskNumber: '2', queueId: 'q-lab' },
        { stepIndex: 2, deskNumber: '2', queueId: 'q-pharmacy' },
      ],
    });

    await expect(
      guard.resolveDeskForJourneyQueue('org', 'owner', 'branch', 'q-pharmacy', '1'),
    ).resolves.toBe('2');
  });

  it('resolveDeskForJourneyQueue honors explicit per-step desk mappings', async () => {
    mockPrisma.desk.findMany = mockDeskFindMany(
      [{ number: '1' }],
      [{ number: '1' }, { number: '2' }, { number: '3' }],
    );
    mockPrisma.branchFlowTemplate.findFirst.mockResolvedValue({
      steps: [
        { stepIndex: 0, deskNumber: '2', queueId: 'q-reception' },
        { stepIndex: 1, deskNumber: '3', queueId: 'q-lab' },
        { stepIndex: 2, deskNumber: '1', queueId: 'q-pharmacy' },
      ],
    });

    await expect(
      guard.resolveDeskForJourneyQueue('org', 'staff', 'branch', 'q-pharmacy', '1'),
    ).resolves.toBe('1');
  });
});
