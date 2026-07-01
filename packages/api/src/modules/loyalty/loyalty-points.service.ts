import { Injectable } from '@nestjs/common';
import {
  LOYALTY_EVENTS,
  LOYALTY_POINT_LEDGER_TYPES,
  LOYALTY_WEBHOOK_EVENTS,
} from '@queueplatform/shared';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoyaltyWebhookService } from './loyalty-webhook.service';
import { LoyaltyPointsLedgerService } from './loyalty-points-ledger.service';
import { LoyaltyMarketingSyncService } from './loyalty-marketing-sync.service';
import {
  type ApplyPointsTxResult,
  type LoyaltyApplyPointsResult,
  type LoyaltyPointsTx,
} from './loyalty-points.types';

export type { ApplyPointsTxResult, LoyaltyApplyPointsResult, LoyaltyPointsTx };

@Injectable()
export class LoyaltyPointsService {
  constructor(
    private readonly ledger: LoyaltyPointsLedgerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
    private readonly marketingSync: LoyaltyMarketingSyncService,
  ) {}

  async burnPoints(
    orgId: string,
    accountId: string,
    points: number,
    source: { sourceType: string; sourceId: string; description?: string },
    tx?: LoyaltyPointsTx,
  ): Promise<LoyaltyApplyPointsResult['account'] | ApplyPointsTxResult> {
    if (tx) {
      return this.ledger.applyPointsInTransaction(
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
    return this.ledger.applyPointsInTransaction(tx, orgId, accountId, Math.abs(points), type, {
      sourceType: 'manual',
      description: description ?? 'Manual adjustment',
    });
  }

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
      // Fire-and-forget marketing sync on every earn
      void this.marketingSync.syncProfile(orgId, result.customerId);
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

  applyPointsInTransaction(
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
    return this.ledger.applyPointsInTransaction(tx, orgId, accountId, points, type, opts);
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
      const result = await this.ledger.runApplyPoints(orgId, accountId, points, type, opts);

      if (result.idempotent) {
        return { account: result.finalAccount, idempotent: true };
      }

      this.dispatchApplyPointsSideEffects(orgId, accountId, result, opts);
      return { account: result.finalAccount, idempotent: false };
    } catch (err) {
      if (this.ledger.isDuplicateEarnError(err, type, opts)) {
        return this.ledger.loadIdempotentEarnAfterConflict(
          orgId,
          accountId,
          type,
          opts.sourceType!,
          opts.sourceId!,
        );
      }
      throw err;
    }
  }
}
