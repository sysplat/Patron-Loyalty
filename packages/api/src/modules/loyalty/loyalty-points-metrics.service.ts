import { Injectable } from '@nestjs/common';
import type { LoyaltyPointsTx } from './loyalty-points.types';

@Injectable()
export class LoyaltyPointsMetricsService {
  async resolveTierForPoints(tx: LoyaltyPointsTx, orgId: string, lifetimePoints: number) {
    return tx.loyaltyTier.findFirst({
      where: { orgId, minLifetimePoints: { lte: lifetimePoints } },
      orderBy: { minLifetimePoints: 'desc' },
    });
  }

  async refreshHealthScore(tx: LoyaltyPointsTx, orgId: string, accountId: string) {
    const account = await tx.loyaltyAccount.findFirst({
      where: { id: accountId, orgId },
      include: { customer: true },
    });
    if (!account) return;

    const recentVisit = await tx.ticket.findFirst({
      where: {
        orgId,
        OR: [
          { customerId: account.customerId },
          ...(account.customer?.phone ? [{ customerPhone: account.customer.phone }] : []),
        ],
        status: 'completed',
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    let healthScore = 50;
    let churnRisk = 'medium';

    if (account.totalVisits >= 10) healthScore += 20;
    else if (account.totalVisits >= 3) healthScore += 10;

    if (account.lifetimePointsEarned >= 500) healthScore += 15;

    if (recentVisit?.completedAt) {
      const daysSince = (Date.now() - recentVisit.completedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 30) {
        healthScore += 15;
        churnRisk = 'low';
      } else if (daysSince <= 90) {
        churnRisk = 'medium';
      } else {
        healthScore -= 20;
        churnRisk = 'high';
      }
    } else {
      churnRisk = 'high';
      healthScore -= 10;
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    await tx.loyaltyAccount.update({
      where: { id: accountId },
      data: { healthScore, churnRisk },
    });
  }
}
