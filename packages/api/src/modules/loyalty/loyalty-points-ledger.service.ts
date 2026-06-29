import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyPointsMetricsService } from './loyalty-points-metrics.service';
import {
  type ApplyPointsTxResult,
  type LoyaltyApplyPointsResult,
  type LoyaltyPointsTx,
  isEarnSourceIdempotentType,
} from './loyalty-points.types';

@Injectable()
export class LoyaltyPointsLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: LoyaltyPointsMetricsService,
  ) {}

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
    const newTier = await this.metrics.resolveTierForPoints(tx, orgId, lifetimeEarned);
    if (newTier && newTier.id !== updatedTierId) {
      await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: { tierId: newTier.id },
      });
      tierUpgradeSlug = newTier.slug;
    }

    await this.metrics.refreshHealthScore(tx, orgId, accountId);

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

  async runApplyPoints(
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
    return this.prisma.withTenant(orgId, (tx) =>
      this.applyPointsInTransaction(tx, orgId, accountId, points, type, opts),
    );
  }

  async loadIdempotentEarnAfterConflict(
    orgId: string,
    accountId: string,
    type: string,
    sourceType: string,
    sourceId: string,
  ): Promise<LoyaltyApplyPointsResult> {
    return this.loadIdempotentEarnResult(orgId, accountId, type, sourceType, sourceId);
  }

  isDuplicateEarnError(
    err: unknown,
    type: string,
    opts: { sourceType?: string; sourceId?: string },
  ): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      isEarnSourceIdempotentType(type) &&
      Boolean(opts.sourceType && opts.sourceId)
    );
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
}
