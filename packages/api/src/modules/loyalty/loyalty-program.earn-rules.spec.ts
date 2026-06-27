import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_EARN_EVENT_TYPES } from '@queueplatform/shared';
import { LoyaltyProgramService } from './loyalty-program.service';

describe('LoyaltyProgramService earn-rule conditions', () => {
  const patronCrmFeature = {
    isEnabled: vi.fn().mockResolvedValue(true),
    requireEnabled: vi.fn(),
  };
  const prisma = {
    withTenant: vi.fn(),
  };

  let service: LoyaltyProgramService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyProgramService(prisma as never, patronCrmFeature as never);
  });

  function mockProgram(program: object) {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyProgram: {
          findUnique: vi.fn().mockResolvedValue(program),
        },
      }),
    );
  }

  it('skips rules when branchId condition does not match', async () => {
    mockProgram({
      enabled: true,
      defaultEarnPoints: 5,
      earnRules: [
        {
          eventType: LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
          points: 20,
          active: true,
          conditions: { branchId: 'branch-a' },
        },
      ],
    });

    const points = await service.resolveEarnPoints(
      'org-1',
      LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
      { branchId: 'branch-b', tierSlug: 'bronze', lifetimePointsEarned: 0 },
    );

    expect(points).toBe(5);
  });

  it('applies rule when branchId and tierSlug match', async () => {
    mockProgram({
      enabled: true,
      defaultEarnPoints: 5,
      earnRules: [
        {
          eventType: LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
          points: 25,
          active: true,
          conditions: { branchId: 'branch-a', tierSlugs: ['gold', 'silver'] },
        },
      ],
    });

    const points = await service.resolveEarnPoints(
      'org-1',
      LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
      { branchId: 'branch-a', tierSlug: 'gold', lifetimePointsEarned: 1000 },
    );

    expect(points).toBe(25);
  });
});
