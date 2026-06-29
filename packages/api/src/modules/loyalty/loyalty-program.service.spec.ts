import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
