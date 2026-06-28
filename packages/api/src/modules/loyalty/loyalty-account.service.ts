import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

      try {
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
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return tx.loyaltyAccount.findUniqueOrThrow({
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
        }
        throw err;
      }
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
    earnContext: {
      branchId?: string;
      purchaseAmountCents?: number;
    } = {},
  ): Promise<LoyaltyApplyPointsResult | null> {
    if (!customerId) return null;
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return null;

    const account = await this.ensureAccount(orgId, customerId);
    if (!account) return null;

    const points = await this.programService.resolveEarnPoints(orgId, eventType, {
      branchId: earnContext.branchId,
      tierSlug: account.tier?.slug ?? null,
      lifetimePointsEarned: account.lifetimePointsEarned,
      purchaseAmountCents: earnContext.purchaseAmountCents,
    });
    if (points <= 0) return null;

    return this.applyPoints(orgId, account.id, points, LOYALTY_POINT_LEDGER_TYPES.EARN, {
      ...source,
      incrementVisit,
    });
  }

  async adjustPoints(
    orgId: string,
    customerId: string,
    points: number,
    description?: string,
    tx?: LoyaltyPointsTx,
  ): Promise<LoyaltyApplyPointsResult['account'] | ApplyPointsTxResult> {
    const type = points > 0 ? LOYALTY_POINT_LEDGER_TYPES.ADJUST : LOYALTY_POINT_LEDGER_TYPES.BURN;
    const absPoints = Math.abs(points);
    const opts = {
      sourceType: 'manual',
      description: description ?? 'Manual adjustment',
    };

    if (tx) {
      const account = await tx.loyaltyAccount.findFirst({ where: { orgId, customerId } });
      if (!account) throw new NotFoundException('Loyalty account not found');
      return this.applyPointsInTransaction(tx, orgId, account.id, absPoints, type, opts);
    }

    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.ensureAccount(orgId, customerId);
    if (!account) throw new NotFoundException('Loyalty account not found');

    const result = await this.applyPoints(orgId, account.id, absPoints, type, opts);
    return result.account;
  }

  async earnIntegrationPoints(
    orgId: string,
    accountId: string,
    points: number,
    source: { sourceId: string; description?: string; incrementVisit?: boolean },
  ) {
    const result = await this.applyPoints(
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

  private async findExistingEarnLedger(
    tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0],
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

  async lookupPatronByPhone(orgId: string, phone: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) {
      throw new BadRequestException('Enter a valid phone number');
    }
    const customer = await this.prisma.withTenant(orgId, (tx) =>
      tx.customer.findFirst({
        where: {
          orgId,
          OR: [{ phone }, { phone: { contains: normalized.slice(-10) } }],
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      }),
    );
    if (!customer) return { found: false as const };
    const visitCount = await this.prisma.withTenant(orgId, (tx) =>
      tx.ticket.count({ where: { orgId, customerId: customer.id } }),
    );
    const account = await this.ensureAccount(orgId, customer.id);
    return {
      found: true as const,
      customer: { ...customer, visitCount },
      loyaltyAccount: account
        ? {
            id: account.id,
            pointsBalance: account.pointsBalance,
            lifetimePointsEarned: account.lifetimePointsEarned,
            tier: account.tier,
            referralCode: account.referralCode,
          }
        : null,
    };
  }

  /** DSAR subject-access export for patron loyalty + CRM data (SRS §22). */
  async exportPatronDsar(orgId: string, customerId: string) {
    await this.patronCrmFeature.requireEnabled(orgId);
    const customer = await this.prisma.withTenant(orgId, (tx) =>
      tx.customer.findFirst({
        where: { id: customerId, orgId },
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
          marketingSmsConsent: true,
          marketingEmailConsent: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
    if (!customer) throw new NotFoundException('Customer not found');

    const account = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findUnique({
        where: { customerId },
        include: {
          tier: true,
          wallet: true,
          badges: { include: { badge: true } },
          challengeProgress: { include: { challenge: true } },
        },
      }),
    );

    const [ledger, redemptions, referrals, tasks, tickets, opportunities, consent, gamePlays] =
      await this.prisma.withTenant(orgId, async (tx) => {
        const accountId = account?.id;
        return Promise.all([
          accountId
            ? tx.loyaltyPointLedger.findMany({
                where: { accountId },
                orderBy: { createdAt: 'desc' },
              })
            : [],
          accountId
            ? tx.loyaltyRedemption.findMany({
                where: { accountId },
                include: { reward: { select: { name: true } } },
              })
            : [],
          tx.loyaltyReferral.findMany({
            where: {
              orgId,
              OR: [{ referredCustomerId: customerId }, { referrerAccount: { customerId } }],
            },
          }),
          tx.crmTask.findMany({ where: { orgId, customerId } }),
          tx.crmSupportTicket.findMany({ where: { orgId, customerId } }),
          tx.crmSalesOpportunity.findMany({ where: { orgId, customerId } }),
          tx.consentLedgerEntry.findMany({ where: { orgId, customerId } }),
          accountId ? tx.loyaltyPatronGamePlay.findMany({ where: { orgId, accountId } }) : [],
        ]);
      });

    return {
      exportedAt: new Date().toISOString(),
      customer,
      loyaltyAccount: account,
      pointLedger: ledger,
      redemptions,
      referrals,
      crmTasks: tasks,
      supportTickets: tickets,
      salesOpportunities: opportunities,
      consentLedger: consent,
      patronGamePlays: gamePlays,
    };
  }
}
