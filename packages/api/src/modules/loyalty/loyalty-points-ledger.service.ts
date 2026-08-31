import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyPointsMetricsService } from './loyalty-points-metrics.service';
import {
  type ApplyPointsTxResult,
  type LoyaltyApplyPointsResult,
  type LoyaltyPointsTx,
  isDebitLedgerType,
  isEarnSourceIdempotentType,
  isLifetimeEarnType,
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
    if (points <= 0) {
      throw new BadRequestException('Points amount must be positive');
    }

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

    const debit = isDebitLedgerType(type);
    let delta: number;
    let balanceAfter: number;
    let lifetimeEarned: number;
    let customerId: string;
    let updatedTierId: string | null;

    if (debit) {
      // BURN and EXPIRE both remove balance atomically. Only BURN counts toward lifetime burned.
      const burned = await tx.loyaltyAccount.updateMany({
        where: { id: accountId, orgId, pointsBalance: { gte: points } },
        data: {
          pointsBalance: { decrement: points },
          ...(type === LOYALTY_POINT_LEDGER_TYPES.BURN
            ? { lifetimePointsBurned: { increment: points } }
            : {}),
        },
      });
      if (burned.count === 0) {
        const exists = await tx.loyaltyAccount.findFirst({
          where: { id: accountId, orgId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Loyalty account not found');
        throw new BadRequestException(
          type === LOYALTY_POINT_LEDGER_TYPES.EXPIRE
            ? 'Insufficient points balance to expire'
            : 'Insufficient points balance',
        );
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
      // EARN / BONUS / ADJUST: atomic increment avoids lost updates under concurrent earns.
      const credited = await tx.loyaltyAccount.updateMany({
        where: { id: accountId, orgId },
        data: {
          pointsBalance: { increment: points },
          ...(isLifetimeEarnType(type) ? { lifetimePointsEarned: { increment: points } } : {}),
          ...(opts.incrementVisit ? { totalVisits: { increment: 1 } } : {}),
        },
      });
      if (credited.count === 0) {
        throw new NotFoundException('Loyalty account not found');
      }
      const accountAfter = await tx.loyaltyAccount.findFirstOrThrow({
        where: { id: accountId, orgId },
        include: { tier: true },
      });
      delta = points;
      balanceAfter = accountAfter.pointsBalance;
      lifetimeEarned = accountAfter.lifetimePointsEarned;
      customerId = accountAfter.customerId;
      updatedTierId = accountAfter.tierId;
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
    const KnownRequestError = Prisma.PrismaClientKnownRequestError;
    const isPrismaConflict =
      typeof KnownRequestError === 'function' && err instanceof KnownRequestError
        ? err.code === 'P2002'
        : typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code?: string }).code === 'P2002';
    return (
      isPrismaConflict &&
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
