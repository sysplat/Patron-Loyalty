import { Injectable, Logger } from '@nestjs/common';
import { LOYALTY_CAMPAIGN_TRIGGERS, type LoyaltyCampaignTrigger } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyCampaignDispatchService } from './loyalty-campaign-dispatch.service';

const ABANDONED_INACTIVE_DAYS = 45;

@Injectable()
export class LoyaltyCampaignAutomationService {
  private readonly logger = new Logger(LoyaltyCampaignAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly accounts: LoyaltyAccountService,
    private readonly dispatch: LoyaltyCampaignDispatchService,
  ) {}

  async fireTrigger(
    orgId: string,
    trigger: LoyaltyCampaignTrigger,
    customerId: string,
  ): Promise<number> {
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return 0;

    const account = await this.accounts.ensureAccount(orgId, customerId);
    if (!account) return 0;

    const campaigns = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.findMany({
        where: { orgId, trigger, status: 'active' },
      }),
    );
    if (campaigns.length === 0) return 0;

    let sent = 0;
    for (const campaign of campaigns) {
      const duplicate = await this.isDuplicateSend(orgId, campaign.id, account.id, trigger);
      if (duplicate) continue;

      const result = await this.dispatch.sendToAccount(orgId, campaign.id, account.id);
      if (result === 'sent') sent += 1;
    }
    return sent;
  }

  async processDailyTriggers(orgId: string): Promise<{
    birthday: number;
    winBack: number;
    abandoned: number;
  }> {
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return { birthday: 0, winBack: 0, abandoned: 0 };

    const birthday = await this.processBirthdays(orgId);
    const winBack = await this.processWinBack(orgId);
    const abandoned = await this.processAbandoned(orgId);
    return { birthday, winBack, abandoned };
  }

  private async processBirthdays(orgId: string): Promise<number> {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();

    const customers = await this.prisma.withTenant(
      orgId,
      (tx) =>
        tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM customers
        WHERE org_id = ${orgId}::uuid
          AND birthday IS NOT NULL
          AND EXTRACT(MONTH FROM birthday) = ${month}
          AND EXTRACT(DAY FROM birthday) = ${day}
      `,
    );

    let sent = 0;
    for (const customer of customers) {
      sent += await this.fireTrigger(orgId, LOYALTY_CAMPAIGN_TRIGGERS.BIRTHDAY, customer.id);
    }
    return sent;
  }

  private async processWinBack(orgId: string): Promise<number> {
    const accounts = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findMany({
        where: { orgId, churnRisk: 'high' },
        select: { customerId: true },
        take: 200,
      }),
    );

    let sent = 0;
    for (const account of accounts) {
      sent += await this.fireTrigger(orgId, LOYALTY_CAMPAIGN_TRIGGERS.WIN_BACK, account.customerId);
    }
    return sent;
  }

  private async processAbandoned(orgId: string): Promise<number> {
    const cutoff = new Date(Date.now() - ABANDONED_INACTIVE_DAYS * 86_400_000);
    const accounts = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findMany({
        where: { orgId, pointsBalance: { gt: 0 } },
        select: { id: true, customerId: true },
        take: 500,
      }),
    );

    let sent = 0;
    for (const account of accounts) {
      const lastLedger = await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyPointLedger.findFirst({
          where: { accountId: account.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      );
      if (!lastLedger || lastLedger.createdAt > cutoff) continue;
      sent += await this.fireTrigger(
        orgId,
        LOYALTY_CAMPAIGN_TRIGGERS.ABANDONED,
        account.customerId,
      );
    }
    return sent;
  }

  private async isDuplicateSend(
    orgId: string,
    campaignId: string,
    accountId: string,
    trigger: LoyaltyCampaignTrigger,
  ): Promise<boolean> {
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const where =
      trigger === LOYALTY_CAMPAIGN_TRIGGERS.BIRTHDAY
        ? { orgId, campaignId, accountId, status: 'sent', sentAt: { gte: yearStart } }
        : trigger === LOYALTY_CAMPAIGN_TRIGGERS.WELCOME ||
            trigger === LOYALTY_CAMPAIGN_TRIGGERS.TIER_UPGRADE
          ? { orgId, campaignId, accountId, status: { in: ['sent', 'queued'] } }
          : { orgId, campaignId, accountId, status: 'sent', sentAt: { gte: thirtyDaysAgo } };

    const existing = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaignSend.findFirst({ where, select: { id: true } }),
    );
    return Boolean(existing);
  }
}
