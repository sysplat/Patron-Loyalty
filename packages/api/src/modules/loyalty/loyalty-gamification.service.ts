import { BadRequestException, Injectable } from '@nestjs/common';
import { LOYALTY_PATRON_GAME_TYPES, type LoyaltyPatronGameType } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { ApplyPointsTxResult, LoyaltyAccountService } from './loyalty-account.service';

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
      const pointsResult = await this.prisma.withTenant(orgId, async (tx) => {
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
            return (await this.accounts.adjustPoints(
              orgId,
              customerId,
              challenge.rewardPoints,
              `Challenge completed: ${challenge.name}`,
              tx,
            )) as ApplyPointsTxResult;
          }
        }
        return null;
      });

      if (pointsResult && !pointsResult.idempotent) {
        this.accounts.dispatchApplyPointsSideEffects(orgId, account.id, pointsResult, {
          sourceType: 'manual',
        });
      }
    }
  }

  async getLeaderboard(orgId: string, limit = 20) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const capped = Math.min(Math.max(limit, 1), 50);
    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findMany({
        where: { orgId },
        orderBy: { lifetimePointsEarned: 'desc' },
        take: capped,
        include: {
          customer: { select: { name: true } },
          tier: { select: { name: true, color: true } },
        },
      }),
    );
    return rows.map((row, index) => ({
      rank: index + 1,
      patronName: row.customer.name,
      lifetimePointsEarned: row.lifetimePointsEarned,
      totalVisits: row.totalVisits,
      tier: row.tier,
    }));
  }

  private spinOutcomes = [
    { label: '10 bonus points', points: 10, weight: 40 },
    { label: '25 bonus points', points: 25, weight: 30 },
    { label: '50 bonus points', points: 50, weight: 20 },
    { label: 'Try again soon', points: 0, weight: 10 },
  ];

  private scratchOutcomes = [
    { label: '5 points', points: 5 },
    { label: '10 points', points: 10 },
    { label: '15 points', points: 15 },
    { label: '25 points', points: 25 },
    { label: '50 points', points: 50 },
  ];

  private pickWeighted<T extends { weight: number }>(items: T[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  async getPatronGameStatus(orgId: string, accountId: string) {
    const cooldownDays: Record<LoyaltyPatronGameType, number> = {
      [LOYALTY_PATRON_GAME_TYPES.SPIN_WHEEL]: 7,
      [LOYALTY_PATRON_GAME_TYPES.SCRATCH_CARD]: 3,
    };
    const result: Record<string, { canPlay: boolean; nextEligibleAt: string | null }> = {};
    for (const gameType of Object.values(LOYALTY_PATRON_GAME_TYPES)) {
      const last = await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyPatronGamePlay.findFirst({
          where: { orgId, accountId, gameType },
          orderBy: { playedAt: 'desc' },
        }),
      );
      const days = cooldownDays[gameType];
      const next = last && days > 0 ? new Date(last.playedAt.getTime() + days * 86_400_000) : null;
      result[gameType] = {
        canPlay: !next || next <= new Date(),
        nextEligibleAt: next && next > new Date() ? next.toISOString() : null,
      };
    }
    return result;
  }

  async playPatronGame(orgId: string, accountId: string, gameType: LoyaltyPatronGameType) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const status = await this.getPatronGameStatus(orgId, accountId);
    if (!status[gameType]?.canPlay) {
      throw new BadRequestException('Game not available yet');
    }

    const account = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findFirst({
        where: { id: accountId, orgId },
        select: { customerId: true },
      }),
    );
    if (!account) throw new BadRequestException('Account not found');

    const outcome =
      gameType === LOYALTY_PATRON_GAME_TYPES.SPIN_WHEEL
        ? this.pickWeighted(this.spinOutcomes)
        : this.scratchOutcomes[Math.floor(Math.random() * this.scratchOutcomes.length)];

    const pointsResult = await this.prisma.withTenant(orgId, async (tx) => {
      await tx.loyaltyPatronGamePlay.create({
        data: {
          orgId,
          accountId,
          gameType,
          resultLabel: outcome.label,
          pointsAwarded: outcome.points,
        },
      });

      if (outcome.points > 0) {
        return (await this.accounts.adjustPoints(
          orgId,
          account.customerId,
          outcome.points,
          `Patron ${gameType.replace('_', ' ')}: ${outcome.label}`,
          tx,
        )) as ApplyPointsTxResult;
      }
      return null;
    });

    if (pointsResult && !pointsResult.idempotent) {
      this.accounts.dispatchApplyPointsSideEffects(orgId, accountId, pointsResult, {
        sourceType: 'manual',
      });
    }

    return { gameType, resultLabel: outcome.label, pointsAwarded: outcome.points };
  }
}
