import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LOYALTY_EARN_EVENT_TYPES,
  LOYALTY_POINT_LEDGER_TYPES,
  LOYALTY_EVENTS,
  LOYALTY_WEBHOOK_EVENTS,
  type LoyaltyEarnEventType,
} from '@queueplatform/shared';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';

@Injectable()
export class LoyaltyAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly programService: LoyaltyProgramService,
    private readonly eventEmitter: EventEmitter2,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
  ) {}

  async ensureAccount(orgId: string, customerId: string) {
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return null;

    await this.programService.getOrCreateProgram(orgId);

    return this.prisma.withTenant(orgId, async (tx) => {
      const existing = await tx.loyaltyAccount.findUnique({
        where: { customerId },
        include: {
          tier: true,
          wallet: true,
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              birthday: true,
              gender: true,
              city: true,
              region: true,
              postalCode: true,
            },
          },
        },
      });
      if (existing) return existing;

      const bronzeTier = await tx.loyaltyTier.findFirst({
        where: { orgId, slug: 'bronze' },
        select: { id: true },
      });

      const referralCode = await this.programService.generateUniqueReferralCode(orgId);

      const account = await tx.loyaltyAccount.create({
        data: {
          orgId,
          customerId,
          tierId: bronzeTier?.id ?? null,
          referralCode,
          wallet: { create: { orgId, balanceCents: 0 } },
        },
        include: {
          tier: true,
          wallet: true,
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              birthday: true,
              gender: true,
              city: true,
              region: true,
              postalCode: true,
            },
          },
        },
      });

      return account;
    });
  }

  async getAccountByCustomerId(orgId: string, customerId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.ensureAccount(orgId, customerId);
    if (!account) throw new NotFoundException('Loyalty account not found');
    return account;
  }

  async getAccountWithLedger(orgId: string, customerId: string, ledgerLimit = 20) {
    const account = await this.getAccountByCustomerId(orgId, customerId);
    const ledger = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPointLedger.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        take: ledgerLimit,
      }),
    );
    return { ...account, ledger };
  }

  async earnFromEvent(
    orgId: string,
    customerId: string | null,
    eventType: LoyaltyEarnEventType,
    source: { sourceType: string; sourceId: string; description?: string },
    incrementVisit = false,
  ) {
    if (!customerId) return null;
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return null;

    const points = await this.programService.resolveEarnPoints(orgId, eventType);
    if (points <= 0) return null;

    const account = await this.ensureAccount(orgId, customerId);
    if (!account) return null;

    return this.applyPoints(orgId, account.id, points, LOYALTY_POINT_LEDGER_TYPES.EARN, {
      ...source,
      incrementVisit,
    });
  }

  async adjustPoints(orgId: string, customerId: string, points: number, description?: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.ensureAccount(orgId, customerId);
    if (!account) throw new NotFoundException('Loyalty account not found');

    const type = points > 0 ? LOYALTY_POINT_LEDGER_TYPES.ADJUST : LOYALTY_POINT_LEDGER_TYPES.BURN;
    return this.applyPoints(orgId, account.id, Math.abs(points), type, {
      sourceType: 'manual',
      description: description ?? 'Manual adjustment',
    });
  }

  async earnIntegrationPoints(
    orgId: string,
    accountId: string,
    points: number,
    source: { sourceId: string; description?: string; incrementVisit?: boolean },
  ) {
    return this.applyPoints(orgId, accountId, points, LOYALTY_POINT_LEDGER_TYPES.EARN, {
      sourceType: 'integration',
      sourceId: source.sourceId,
      description: source.description,
      incrementVisit: source.incrementVisit,
    });
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

      await this.applyPoints(
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

    const account = await this.ensureAccount(orgId, customerId);
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

  async burnPoints(
    orgId: string,
    accountId: string,
    points: number,
    source: { sourceType: string; sourceId: string; description?: string },
  ) {
    return this.applyPoints(orgId, accountId, points, LOYALTY_POINT_LEDGER_TYPES.BURN, source);
  }

  private async applyPoints(
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
  ) {
    const result = await this.prisma.withTenant(orgId, async (tx) => {
      const account = await tx.loyaltyAccount.findFirst({
        where: { id: accountId, orgId },
      });
      if (!account) throw new NotFoundException('Loyalty account not found');

      const isBurn = type === LOYALTY_POINT_LEDGER_TYPES.BURN;
      if (isBurn && account.pointsBalance < points) {
        throw new BadRequestException('Insufficient points balance');
      }

      const delta = isBurn ? -points : points;
      const balanceAfter = account.pointsBalance + delta;
      const lifetimeEarned =
        type === LOYALTY_POINT_LEDGER_TYPES.EARN || type === LOYALTY_POINT_LEDGER_TYPES.BONUS
          ? account.lifetimePointsEarned + points
          : account.lifetimePointsEarned;
      const lifetimeBurned = isBurn
        ? account.lifetimePointsBurned + points
        : account.lifetimePointsBurned;

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

      const newTier = await this.resolveTierForPoints(tx, orgId, lifetimeEarned);
      if (newTier && newTier.id !== updated.tierId) {
        await tx.loyaltyAccount.update({
          where: { id: accountId },
          data: { tierId: newTier.id },
        });
        this.eventEmitter.emit(LOYALTY_EVENTS.TIER_UPGRADED, orgId, accountId, newTier.slug);
      }

      await this.refreshHealthScore(tx, orgId, accountId);

      const finalAccount = await tx.loyaltyAccount.findUniqueOrThrow({
        where: { id: accountId },
        include: { tier: true, customer: { select: { id: true, name: true } } },
      });

      return { finalAccount, type, points, delta, customerId: account.customerId };
    });

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

    return result.finalAccount;
  }

  private async resolveTierForPoints(
    tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0],
    orgId: string,
    lifetimePoints: number,
  ) {
    return tx.loyaltyTier.findFirst({
      where: { orgId, minLifetimePoints: { lte: lifetimePoints } },
      orderBy: { minLifetimePoints: 'desc' },
    });
  }

  private async refreshHealthScore(
    tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0],
    orgId: string,
    accountId: string,
  ) {
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
          ...(account.customer.phone ? [{ customerPhone: account.customer.phone }] : []),
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

  async handleTicketCompleted(
    orgId: string,
    ticketId: string,
    customerId: string | null,
    branchId: string,
  ) {
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
    );
  }

  async handleAppointmentCompleted(
    orgId: string,
    appointmentId: string,
    customerId: string | null,
  ) {
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
    );
  }

  async handleReviewSubmitted(orgId: string, reviewId: string, customerId: string | null) {
    return this.earnFromEvent(orgId, customerId, LOYALTY_EARN_EVENT_TYPES.REVIEW_SUBMITTED, {
      sourceType: 'review',
      sourceId: reviewId,
      description: 'Points for review',
    });
  }
}
