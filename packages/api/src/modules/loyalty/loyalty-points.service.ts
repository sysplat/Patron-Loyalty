import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  LOYALTY_EVENTS,
  LOYALTY_POINT_LEDGER_TYPES,
  LOYALTY_WEBHOOK_EVENTS,
} from '@queueplatform/shared';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';

export type LoyaltyApplyPointsResult = {
  account: {
    id: string;
    orgId: string;
    customerId: string;
    pointsBalance: number;
    lifetimePointsEarned: number;
    lifetimePointsBurned: number;
    totalVisits: number;
    tierId: string | null;
    tier: { id: string; slug: string; name: string } | null;
    customer: { id: string; name: string | null };
  };
  idempotent: boolean;
};

function isEarnSourceIdempotentType(type: string): boolean {
  return type === LOYALTY_POINT_LEDGER_TYPES.EARN || type === LOYALTY_POINT_LEDGER_TYPES.BONUS;
}

export type LoyaltyPointsTx = Parameters<Parameters<PrismaService['withTenant']>[1]>[0];

export type ApplyPointsTxResult = {
  finalAccount: LoyaltyApplyPointsResult['account'];
  type: string;
  points: number;
  delta: number;
  customerId: string;
  idempotent: boolean;
  tierUpgradeSlug?: string | null;
};

@Injectable()
export class LoyaltyPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
  ) {}

  async burnPoints(
    orgId: string,
    accountId: string,
    points: number,
    source: { sourceType: string; sourceId: string; description?: string },
    tx?: LoyaltyPointsTx,
  ): Promise<LoyaltyApplyPointsResult['account'] | ApplyPointsTxResult> {
    if (tx) {
      return this.applyPointsInTransaction(
        tx,
        orgId,
        accountId,
        points,
        LOYALTY_POINT_LEDGER_TYPES.BURN,
        source,
      );
    }
    const result = await this.applyPoints(
      orgId,
      accountId,
      points,
      LOYALTY_POINT_LEDGER_TYPES.BURN,
      source,
    );
    return result.account;
  }

  async adjustPointsInTransaction(
    tx: LoyaltyPointsTx,
    orgId: string,
    accountId: string,
    points: number,
    description?: string,
  ): Promise<ApplyPointsTxResult> {
    const type = points > 0 ? LOYALTY_POINT_LEDGER_TYPES.ADJUST : LOYALTY_POINT_LEDGER_TYPES.BURN;
    return this.applyPointsInTransaction(tx, orgId, accountId, Math.abs(points), type, {
      sourceType: 'manual',
      description: description ?? 'Manual adjustment',
    });
  }

  /** Post-commit side effects after `applyPointsInTransaction` inside an outer transaction. */
  dispatchApplyPointsSideEffects(
    orgId: string,
    accountId: string,
    result: ApplyPointsTxResult,
    opts: {
      sourceType?: string;
      sourceId?: string;
    },
  ): void {
    if (result.idempotent) return;

    if (result.tierUpgradeSlug) {
      this.eventEmitter.emit(
        LOYALTY_EVENTS.TIER_UPGRADED,
        orgId,
        accountId,
        result.tierUpgradeSlug,
      );
    }

    if (
      result.type === LOYALTY_POINT_LEDGER_TYPES.EARN ||
      result.type === LOYALTY_POINT_LEDGER_TYPES.BONUS ||
      (result.type === LOYALTY_POINT_LEDGER_TYPES.ADJUST && result.delta > 0)
    ) {
      void this.loyaltyWebhook.dispatch(orgId, LOYALTY_WEBHOOK_EVENTS.POINTS_EARNED, {
        customerId: result.customerId,
        accountId: result.finalAccount.id,
        points: result.points,
        balanceAfter: result.finalAccount.pointsBalance,
        sourceType: opts.sourceType ?? null,
        sourceId: opts.sourceId ?? null,
      });
    }
    if (result.type === LOYALTY_POINT_LEDGER_TYPES.BURN) {
      void this.loyaltyWebhook.dispatch(orgId, LOYALTY_WEBHOOK_EVENTS.POINTS_REDEEMED, {
        customerId: result.customerId,
        accountId: result.finalAccount.id,
        points: result.points,
        balanceAfter: result.finalAccount.pointsBalance,
        sourceType: opts.sourceType ?? null,
        sourceId: opts.sourceId ?? null,
      });
    }
  }

  async applyPointsInTransaction(
    tx: LoyaltyPointsTx,
    orgId: string,
    accountId: string,
    points: number,
    type: string,
    opts: {
      sourceType?: string;
      sourceId?: string;
      description?: string;
      incrementVisit?: boolean;
    },
  ): Promise<ApplyPointsTxResult> {
    if (isEarnSourceIdempotentType(type) && opts.sourceType && opts.sourceId) {
      const existing = await this.findExistingEarnLedger(
        tx,
        orgId,
        accountId,
        type,
        opts.sourceType,
        opts.sourceId,
      );
      if (existing) {
        const finalAccount = await tx.loyaltyAccount.findUniqueOrThrow({
          where: { id: accountId },
          include: { tier: true, customer: { select: { id: true, name: true } } },
        });
        return {
          finalAccount,
          type,
          points: Math.abs(existing.points),
          delta: 0,
          customerId: finalAccount.customer.id,
          idempotent: true,
        };
      }
    }

    const isBurn = type === LOYALTY_POINT_LEDGER_TYPES.BURN;
    let delta: number;
    let balanceAfter: number;
    let lifetimeEarned: number;
    let customerId: string;
    let updatedTierId: string | null;

    if (isBurn) {
      const burned = await tx.loyaltyAccount.updateMany({
        where: { id: accountId, orgId, pointsBalance: { gte: points } },
        data: {
          pointsBalance: { decrement: points },
          lifetimePointsBurned: { increment: points },
        },
      });
      if (burned.count === 0) {
        throw new BadRequestException('Insufficient points balance');
      }
      const accountAfter = await tx.loyaltyAccount.findFirstOrThrow({
        where: { id: accountId, orgId },
        include: { tier: true },
      });
      delta = -points;
      balanceAfter = accountAfter.pointsBalance;
      lifetimeEarned = accountAfter.lifetimePointsEarned;
      customerId = accountAfter.customerId;
      updatedTierId = accountAfter.tierId;
    } else {
      const account = await tx.loyaltyAccount.findFirst({
        where: { id: accountId, orgId },
      });
      if (!account) throw new NotFoundException('Loyalty account not found');

      delta = points;
      balanceAfter = account.pointsBalance + points;
      lifetimeEarned =
        type === LOYALTY_POINT_LEDGER_TYPES.EARN || type === LOYALTY_POINT_LEDGER_TYPES.BONUS
          ? account.lifetimePointsEarned + points
          : account.lifetimePointsEarned;
      const lifetimeBurned = account.lifetimePointsBurned;

      const updated = await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: {
          pointsBalance: balanceAfter,
          lifetimePointsEarned: lifetimeEarned,
          lifetimePointsBurned: lifetimeBurned,
          totalVisits: opts.incrementVisit ? { increment: 1 } : undefined,
        },
        include: { tier: true },
      });
      customerId = account.customerId;
      updatedTierId = updated.tierId;
    }

    await tx.loyaltyPointLedger.create({
      data: {
        orgId,
        accountId,
        type,
        points: delta,
        balanceAfter,
        sourceType: opts.sourceType ?? null,
        sourceId: opts.sourceId ?? null,
        description: opts.description ?? null,
      },
    });

    let tierUpgradeSlug: string | null = null;
    const newTier = await this.resolveTierForPoints(tx, orgId, lifetimeEarned);
    if (newTier && newTier.id !== updatedTierId) {
      await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: { tierId: newTier.id },
      });
      tierUpgradeSlug = newTier.slug;
    }

    await this.refreshHealthScore(tx, orgId, accountId);

    const finalAccount = await tx.loyaltyAccount.findUniqueOrThrow({
      where: { id: accountId },
      include: { tier: true, customer: { select: { id: true, name: true } } },
    });

    return {
      finalAccount,
      type,
      points,
      delta,
      customerId,
      idempotent: false,
      tierUpgradeSlug,
    };
  }

  async applyPoints(
    orgId: string,
    accountId: string,
    points: number,
    type: string,
    opts: {
      sourceType?: string;
      sourceId?: string;
      description?: string;
      incrementVisit?: boolean;
    },
  ): Promise<LoyaltyApplyPointsResult> {
    try {
      const result = await this.prisma.withTenant(orgId, (tx) =>
        this.applyPointsInTransaction(tx, orgId, accountId, points, type, opts),
      );

      if (result.idempotent) {
        return { account: result.finalAccount, idempotent: true };
      }

      this.dispatchApplyPointsSideEffects(orgId, accountId, result, opts);
      return { account: result.finalAccount, idempotent: false };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        isEarnSourceIdempotentType(type) &&
        opts.sourceType &&
        opts.sourceId
      ) {
        return this.loadIdempotentEarnResult(
          orgId,
          accountId,
          type,
          opts.sourceType,
          opts.sourceId,
        );
      }
      throw err;
    }
  }

  private async findExistingEarnLedger(
    tx: LoyaltyPointsTx,
    orgId: string,
    accountId: string,
    type: string,
    sourceType: string,
    sourceId: string,
  ) {
    return tx.loyaltyPointLedger.findFirst({
      where: { orgId, accountId, sourceType, sourceId, type },
      select: { id: true, points: true },
    });
  }

  private async loadIdempotentEarnResult(
    orgId: string,
    accountId: string,
    type: string,
    sourceType: string,
    sourceId: string,
  ): Promise<LoyaltyApplyPointsResult> {
    return this.prisma.withTenant(orgId, async (tx) => {
      const existing = await this.findExistingEarnLedger(
        tx,
        orgId,
        accountId,
        type,
        sourceType,
        sourceId,
      );
      if (!existing) {
        throw new BadRequestException('Duplicate earn source could not be resolved');
      }
      const account = await tx.loyaltyAccount.findUniqueOrThrow({
        where: { id: accountId },
        include: { tier: true, customer: { select: { id: true, name: true } } },
      });
      return { account, idempotent: true };
    });
  }

  private async resolveTierForPoints(tx: LoyaltyPointsTx, orgId: string, lifetimePoints: number) {
    return tx.loyaltyTier.findFirst({
      where: { orgId, minLifetimePoints: { lte: lifetimePoints } },
      orderBy: { minLifetimePoints: 'desc' },
    });
  }

  private async refreshHealthScore(tx: LoyaltyPointsTx, orgId: string, accountId: string) {
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
