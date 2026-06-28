import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import {
  LoyaltyPointsService,
  type ApplyPointsTxResult,
  type LoyaltyApplyPointsResult,
  type LoyaltyPointsTx,
} from './loyalty-points.service';

export type { ApplyPointsTxResult, LoyaltyApplyPointsResult, LoyaltyPointsTx };

@Injectable()
export class LoyaltyAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly programService: LoyaltyProgramService,
    private readonly loyaltyWebhook: LoyaltyWebhookService,
    private readonly points: LoyaltyPointsService,
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

    return this.points.applyPoints(orgId, account.id, points, LOYALTY_POINT_LEDGER_TYPES.EARN, {
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
    if (tx) {
      const account = await tx.loyaltyAccount.findFirst({ where: { orgId, customerId } });
      if (!account) throw new NotFoundException('Loyalty account not found');
      return this.points.adjustPointsInTransaction(tx, orgId, account.id, points, description);
    }

    await this.patronCrmFeature.requireEnabled(orgId);
    const account = await this.ensureAccount(orgId, customerId);
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
