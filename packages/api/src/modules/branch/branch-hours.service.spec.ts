import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchHoursService } from './branch-hours.service';

function mockTenantClient(overrides: {
  branchTimezone?: string;
  dateOverride?: unknown;
  weeklyHours?: unknown;
}) {
  return {
    branch: {
      findUnique: vi.fn().mockResolvedValue({ timezone: overrides.branchTimezone ?? 'UTC' }),
    },
    branchDateOverride: {
      findUnique: vi.fn().mockResolvedValue(overrides.dateOverride ?? null),
    },
    workingHours: {
      findUnique: vi.fn().mockResolvedValue(overrides.weeklyHours ?? null),
    },
  };
}

describe('BranchHoursService', () => {
  const prisma = {
    withTenant: vi.fn(),
  };

  let service: BranchHoursService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BranchHoursService(prisma as never);
  });

  it('throws when branch is closed on a date override', async () => {
    prisma.withTenant.mockImplementation(
      async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn(
          mockTenantClient({
            dateOverride: {
              isClosed: true,
              openTime: null,
              closeTime: null,
              breakStart: null,
              breakEnd: null,
            },
          }),
        ),
    );

    await expect(
      service.assertBranchAcceptsCustomerIntake('org-1', 'branch-1', 'issuing tickets'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows operations during open weekly hours', async () => {
    prisma.withTenant.mockImplementation(
      async (_orgId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn(
          mockTenantClient({
            weeklyHours: {
              openTime: '00:00',
              closeTime: '23:59',
              isClosed: false,
              breakStart: null,
              breakEnd: null,
            },
          }),
        ),
    );

    await expect(
      service.assertBranchAcceptsCustomerIntake('org-1', 'branch-1', 'issuing tickets'),
    ).resolves.toBeUndefined();
  });
});
