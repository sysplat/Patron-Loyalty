import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';

@Injectable()
export class LoyaltyAccountDsarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

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
