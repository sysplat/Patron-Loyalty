import { describe, it, expect, vi } from 'vitest';
import { LoyaltyPointsMetricsService } from './loyalty-points-metrics.service';

describe('LoyaltyPointsMetricsService', () => {
  const service = new LoyaltyPointsMetricsService();

  it('resolves highest qualifying tier for lifetime points', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'tier-gold', name: 'Gold' });
    const tx = { loyaltyTier: { findFirst } };

    const tier = await service.resolveTierForPoints(tx as never, 'org-1', 500);

    expect(tier).toEqual({ id: 'tier-gold', name: 'Gold' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { orgId: 'org-1', minLifetimePoints: { lte: 500 } },
      orderBy: { minLifetimePoints: 'desc' },
    });
  });

  it('updates health score for active patron', async () => {
    const update = vi.fn().mockResolvedValue({});
    const recentDate = new Date(Date.now() - 5 * 86_400_000);
    const tx = {
      loyaltyAccount: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'acct-1',
          orgId: 'org-1',
          customerId: 'cust-1',
          totalVisits: 12,
          lifetimePointsEarned: 600,
          customer: { phone: '+15551234567' },
        }),
        update,
      },
      ticket: {
        findFirst: vi.fn().mockResolvedValue({ completedAt: recentDate }),
      },
    };

    await service.refreshHealthScore(tx as never, 'org-1', 'acct-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'acct-1' },
      data: expect.objectContaining({ churnRisk: 'low', healthScore: expect.any(Number) }),
    });
  });
});
