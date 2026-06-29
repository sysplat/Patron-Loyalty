import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_EARN_EVENT_TYPES } from '@queueplatform/shared';
import { LoyaltyProgramService } from './loyalty-program.service';

const ORG_ID = 'org-1';

describe('LoyaltyProgramService', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyProgramService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyProgramService(prisma as never, patronCrmFeature as never);
  });

  it('returns existing program without seeding defaults', async () => {
    const existing = { id: 'prog-1', orgId: ORG_ID, tiers: [], earnRules: [] };
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyProgram: {
          findUnique: vi.fn().mockResolvedValue(existing),
        },
      }),
    );

    const program = await service.getOrCreateProgram(ORG_ID);
    expect(program).toBe(existing);
  });

  it('creates program with default tiers and earn rules', async () => {
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: 'prog-new',
      tiers: [{ slug: 'bronze' }],
      earnRules: [{ eventType: 'VISIT' }],
    });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyProgram: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'prog-new' }),
          findUniqueOrThrow,
        },
        loyaltyTier: { createMany: vi.fn().mockResolvedValue({ count: 3 }) },
        loyaltyEarnRule: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      }),
    );

    const program = await service.getOrCreateProgram(ORG_ID);
    expect(program.id).toBe('prog-new');
    expect(patronCrmFeature.requireEnabled).toHaveBeenCalledWith(ORG_ID);
  });

  it('updates program settings', async () => {
    const getSpy = vi
      .spyOn(service, 'getOrCreateProgram')
      .mockResolvedValue({ id: 'prog-1' } as never);
    const update = vi.fn().mockResolvedValue({ id: 'prog-1', defaultEarnPoints: 5 });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ loyaltyProgram: { update } }),
    );

    const program = await service.updateProgram(ORG_ID, { defaultEarnPoints: 5 });

    expect(getSpy).toHaveBeenCalledWith(ORG_ID);
    expect(program).toEqual({ id: 'prog-1', defaultEarnPoints: 5 });
  });

  it('resolves purchase points from matching earn rule', async () => {
    patronCrmFeature.isEnabled = vi.fn().mockResolvedValue(true);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyProgram: {
          findUnique: vi.fn().mockResolvedValue({
            enabled: true,
            defaultEarnPoints: 1,
            earnRules: [
              {
                points: 1,
                eventType: LOYALTY_EARN_EVENT_TYPES.PURCHASE,
                conditions: { minPurchaseCents: 1000 },
              },
            ],
          }),
        },
      }),
    );

    const points = await service.resolveEarnPoints(ORG_ID, LOYALTY_EARN_EVENT_TYPES.PURCHASE, {
      purchaseAmountCents: 2500,
    });

    expect(points).toBe(25);
  });

  it('returns zero when loyalty feature disabled', async () => {
    patronCrmFeature.isEnabled = vi.fn().mockResolvedValue(false);

    const points = await service.resolveEarnPoints(ORG_ID, LOYALTY_EARN_EVENT_TYPES.VISIT);

    expect(points).toBe(0);
  });
});
