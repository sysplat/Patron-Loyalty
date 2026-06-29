import { Injectable } from '@nestjs/common';
import type { LoyaltyEarnEventType } from '@queueplatform/shared';
import {
  LoyaltyPointsService,
  type ApplyPointsTxResult,
  type LoyaltyApplyPointsResult,
  type LoyaltyPointsTx,
} from './loyalty-points.service';
import { LoyaltyAccountLifecycleService } from './loyalty-account-lifecycle.service';
import { LoyaltyAccountEarnService } from './loyalty-account-earn.service';
import { LoyaltyAccountDsarService } from './loyalty-account-dsar.service';

export type { ApplyPointsTxResult, LoyaltyApplyPointsResult, LoyaltyPointsTx };

/** Lifecycle facade — delegates to focused account services. */
@Injectable()
export class LoyaltyAccountService {
  constructor(
    private readonly lifecycle: LoyaltyAccountLifecycleService,
    private readonly earn: LoyaltyAccountEarnService,
    private readonly dsar: LoyaltyAccountDsarService,
    private readonly points: LoyaltyPointsService,
  ) {}

  ensureAccount(orgId: string, customerId: string) {
    return this.lifecycle.ensureAccount(orgId, customerId);
  }

  getAccountByCustomerId(orgId: string, customerId: string) {
    return this.lifecycle.getAccountByCustomerId(orgId, customerId);
  }

  getAccountWithLedger(orgId: string, customerId: string, ledgerLimit = 20) {
    return this.lifecycle.getAccountWithLedger(orgId, customerId, ledgerLimit);
  }

  lookupPatronByPhone(orgId: string, phone: string) {
    return this.lifecycle.lookupPatronByPhone(orgId, phone);
  }

  earnFromEvent(
    orgId: string,
    customerId: string | null,
    eventType: LoyaltyEarnEventType,
    source: { sourceType: string; sourceId: string; description?: string },
    incrementVisit = false,
    earnContext: { branchId?: string; purchaseAmountCents?: number } = {},
  ) {
    return this.earn.earnFromEvent(
      orgId,
      customerId,
      eventType,
      source,
      incrementVisit,
      earnContext,
    );
  }

  adjustPoints(
    orgId: string,
    customerId: string,
    points: number,
    description?: string,
    tx?: LoyaltyPointsTx,
  ) {
    return this.earn.adjustPoints(orgId, customerId, points, description, tx);
  }

  earnIntegrationPoints(
    orgId: string,
    accountId: string,
    points: number,
    source: { sourceId: string; description?: string; incrementVisit?: boolean },
  ) {
    return this.earn.earnIntegrationPoints(orgId, accountId, points, source);
  }

  expireInactivePoints(orgId: string, pointsExpiryDays: number) {
    return this.earn.expireInactivePoints(orgId, pointsExpiryDays);
  }

  handleNoShow(
    orgId: string,
    customerId: string | null,
    source: { sourceType: string; sourceId: string },
  ) {
    return this.earn.handleNoShow(orgId, customerId, source);
  }

  handleTicketCompleted(
    orgId: string,
    ticketId: string,
    customerId: string | null,
    branchId: string,
  ) {
    return this.earn.handleTicketCompleted(orgId, ticketId, customerId, branchId);
  }

  handleAppointmentCompleted(
    orgId: string,
    appointmentId: string,
    customerId: string | null,
    branchId?: string,
  ) {
    return this.earn.handleAppointmentCompleted(orgId, appointmentId, customerId, branchId);
  }

  handleReviewSubmitted(orgId: string, reviewId: string, customerId: string | null) {
    return this.earn.handleReviewSubmitted(orgId, reviewId, customerId);
  }

  exportPatronDsar(orgId: string, customerId: string) {
    return this.dsar.exportPatronDsar(orgId, customerId);
  }

  burnPoints(
    orgId: string,
    accountId: string,
    points: number,
    source: { sourceType: string; sourceId: string; description?: string },
    tx?: LoyaltyPointsTx,
  ) {
    return this.points.burnPoints(orgId, accountId, points, source, tx);
  }

  dispatchApplyPointsSideEffects(
    orgId: string,
    accountId: string,
    result: ApplyPointsTxResult,
    opts: { sourceType?: string; sourceId?: string },
  ): void {
    this.points.dispatchApplyPointsSideEffects(orgId, accountId, result, opts);
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
    return this.points.applyPointsInTransaction(tx, orgId, accountId, points, type, opts);
  }
}
