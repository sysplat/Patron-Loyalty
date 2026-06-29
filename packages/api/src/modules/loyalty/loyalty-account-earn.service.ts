import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LOYALTY_EARN_EVENT_TYPES,
  LOYALTY_POINT_LEDGER_TYPES,
  LOYALTY_WEBHOOK_EVENTS,
  type LoyaltyEarnEventType,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';
import { LoyaltyAccountLifecycleService } from './loyalty-account-lifecycle.service';
import {
  LoyaltyPointsService,
  type ApplyPointsTxResult,
  type LoyaltyApplyPointsResult,
  type LoyaltyPointsTx,
} from './loyalty-points.service';

@Injectable()
export class LoyaltyAccountEarnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly programService: LoyaltyProgramService,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
    private readonly lifecycle: LoyaltyAccountLifecycleService,
    private readonly points: LoyaltyPointsService,
  ) {}

  async earnFromEvent(
    orgId: string,
    customerId: string | null,
    eventType: LoyaltyEarnEventType,
    source: { sourceType: string; sourceId: string; description?: string },
    incrementVisit = false,
    earnContext: {
      branchId?: string;
      purchaseAmountCents?: number;
    } = {},
  ): Promise<LoyaltyApplyPointsResult | null> {
    if (!customerId) return null;
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return null;

    const account = await this.lifecycle.ensureAccount(orgId, customerId);
    if (!account) return null;

    const points = await this.programService.resolveEarnPoints(orgId, eventType, {
      branchId: earnContext.branchId,
      tierSlug: account.tier?.slug ?? null,
      lifetimePointsEarned: account.lifetimePointsEarned,
      purchaseAmountCents: earnContext.purchaseAmountCents,
    });
    if (points <= 0) return null;

    return this.points.applyPoints(orgId, account.id, points, LOYALTY_POINT_LEDGER_TYPES.EARN, {
      ...source,
      incrementVisit,
    });
  }

  async earnIntegrationPoints(
    orgId: string,
    accountId: string,
    points: number,
    source: { sourceId: string; description?: string; incrementVisit?: boolean },
  ) {
    const result = await this.points.applyPoints(
      orgId,
      accountId,
      points,
      LOYALTY_POINT_LEDGER_TYPES.EARN,
      {
        sourceType: 'integration',
        sourceId: source.sourceId,
        description: source.description,
        incrementVisit: source.incrementVisit,
      },
    );
    return result.account;
  }

  async expireInactivePoints(orgId: string, pointsExpiryDays: number): Promise<number> {
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled || pointsExpiryDays < 1) return 0;

    const cutoff = new Date(Date.now() - pointsExpiryDays * 86_400_000);
    let expiredAccounts = 0;

    const accounts = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findMany({
        where: { orgId, pointsBalance: { gt: 0 } },
        select: { id: true, pointsBalance: true },
      }),
    );

    for (const account of accounts) {
      const lastActivity = await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyPointLedger.findFirst({
          where: { accountId: account.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      );
      if (!lastActivity || lastActivity.createdAt > cutoff) continue;

      await this.points.applyPoints(
        orgId,
        account.id,
        account.pointsBalance,
        LOYALTY_POINT_LEDGER_TYPES.EXPIRE,
        {
          sourceType: 'expiry',
          description: `Points expired after ${pointsExpiryDays} days of inactivity`,
        },
      );
      expiredAccounts += 1;
    }

    return expiredAccounts;
  }

  async handleNoShow(
    orgId: string,
    customerId: string | null,
    source: { sourceType: string; sourceId: string },
  ) {
    if (!customerId) return null;
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return null;

    const account = await this.lifecycle.ensureAccount(orgId, customerId);
    if (!account) return null;

    await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          healthScore: Math.max(0, account.healthScore - 20),
          churnRisk: 'high',
        },
      }),
    );

    void this.loyaltyWebhook.dispatch(orgId, LOYALTY_WEBHOOK_EVENTS.VISIT_NO_SHOW, {
      customerId,
      accountId: account.id,
      ...source,
    });

    return account;
  }

  async handleTicketCompleted(
    orgId: string,
    ticketId: string,
    customerId: string | null,
    branchId: string,
  ): Promise<LoyaltyApplyPointsResult | null> {
    return this.earnFromEvent(
      orgId,
      customerId,
      LOYALTY_EARN_EVENT_TYPES.TICKET_COMPLETED,
      {
        sourceType: 'ticket',
        sourceId: ticketId,
        description: 'Points for completed visit',
      },
      true,
      { branchId: branchId || undefined },
    );
  }

  async handleAppointmentCompleted(
    orgId: string,
    appointmentId: string,
    customerId: string | null,
    branchId?: string,
  ): Promise<LoyaltyApplyPointsResult | null> {
    return this.earnFromEvent(
      orgId,
      customerId,
      LOYALTY_EARN_EVENT_TYPES.APPOINTMENT_COMPLETED,
      {
        sourceType: 'appointment',
        sourceId: appointmentId,
        description: 'Points for completed appointment',
      },
      true,
      { branchId: branchId || undefined },
    );
  }

  async handleReviewSubmitted(
    orgId: string,
    reviewId: string,
    customerId: string | null,
  ): Promise<LoyaltyApplyPointsResult | null> {
    return this.earnFromEvent(orgId, customerId, LOYALTY_EARN_EVENT_TYPES.REVIEW_SUBMITTED, {
      sourceType: 'review',
      sourceId: reviewId,
      description: 'Points for review',
    });
  }

  async adjustPoints(
    orgId: string,
    customerId: string,
    points: number,
    description?: string,
    tx?: LoyaltyPointsTx,
  ): Promise<LoyaltyApplyPointsResult['account'] | ApplyPointsTxResult> {
    if (tx) {
      const account = await tx.loyaltyAccount.findFirst({ where: { orgId, customerId } });
      if (!account) throw new NotFoundException('Loyalty account not found');
      return this.points.adjustPointsInTransaction(tx, orgId, account.id, points, description);
    }

    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.lifecycle.ensureAccount(orgId, customerId);
    if (!account) throw new NotFoundException('Loyalty account not found');

    const result = await this.points.applyPoints(
      orgId,
      account.id,
      Math.abs(points),
      points > 0 ? LOYALTY_POINT_LEDGER_TYPES.ADJUST : LOYALTY_POINT_LEDGER_TYPES.BURN,
      {
        sourceType: 'manual',
        description: description ?? 'Manual adjustment',
      },
    );
    return result.account;
  }
}
