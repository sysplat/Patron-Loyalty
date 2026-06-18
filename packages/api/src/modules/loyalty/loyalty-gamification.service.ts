import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from './loyalty-account.service';

@Injectable()
export class LoyaltyGamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
  ) {}

  async listBadges(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyBadge.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    );
  }

  async createBadge(orgId: string, data: object) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyBadge.create({ data: { orgId, ...data } as never }),
    );
  }

  async listChallenges(orgId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyChallenge.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async createChallenge(orgId: string, data: Record<string, unknown>) {
    await this.patronCrmFeature.requireEnabled(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyChallenge.create({ data: { orgId, ...data } as never }),
    );
  }

  async evaluateBadgesForAccount(orgId: string, customerId: string) {
    const account = await this.accounts.ensureAccount(orgId, customerId);
    if (!account) return [];

    const badges = await this.listBadges(orgId);
    const awarded: string[] = [];

    for (const badge of badges) {
      const criteria = badge.criteria as { minVisits?: number; minPoints?: number };
      const eligible =
        (criteria.minVisits === undefined || account.totalVisits >= criteria.minVisits) &&
        (criteria.minPoints === undefined || account.lifetimePointsEarned >= criteria.minPoints);

      if (!eligible) continue;

      const existing = await this.prisma.withTenant(orgId, (tx) =>
        tx.customerBadge.findUnique({
          where: { accountId_badgeId: { accountId: account.id, badgeId: badge.id } },
        }),
      );
      if (existing) continue;

      await this.prisma.withTenant(orgId, (tx) =>
        tx.customerBadge.create({
          data: { orgId, accountId: account.id, badgeId: badge.id },
        }),
      );
      awarded.push(badge.name);
    }

    return awarded;
  }

  async incrementChallengeProgress(
    orgId: string,
    customerId: string,
    targetType: string,
    amount = 1,
  ) {
    const account = await this.accounts.ensureAccount(orgId, customerId);
    if (!account) return;

    const challenges = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyChallenge.findMany({ where: { orgId, active: true, targetType } }),
    );

    for (const challenge of challenges) {
      await this.prisma.withTenant(orgId, async (tx) => {
        const progress = await tx.customerChallengeProgress.upsert({
          where: { accountId_challengeId: { accountId: account.id, challengeId: challenge.id } },
          create: { orgId, accountId: account.id, challengeId: challenge.id, progress: amount },
          update: { progress: { increment: amount } },
        });

        if (!progress.completedAt && progress.progress >= challenge.targetValue) {
          await tx.customerChallengeProgress.update({
            where: { id: progress.id },
            data: { completedAt: new Date(), progress: challenge.targetValue },
          });
          if (challenge.rewardPoints > 0) {
            await this.accounts.adjustPoints(
              orgId,
              customerId,
              challenge.rewardPoints,
              `Challenge completed: ${challenge.name}`,
            );
          }
        }
      });
    }
  }
}
