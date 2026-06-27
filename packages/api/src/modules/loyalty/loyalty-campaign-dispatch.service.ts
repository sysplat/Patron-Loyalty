import { Injectable, Logger } from '@nestjs/common';
import { LOYALTY_CAMPAIGN_CHANNELS } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class LoyaltyCampaignDispatchService {
  private readonly logger = new Logger(LoyaltyCampaignDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async dispatchCampaign(
    orgId: string,
    campaignId: string,
  ): Promise<{ sent: number; skipped: number; failed: number }> {
    const campaign = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.findFirst({ where: { id: campaignId, orgId } }),
    );
    if (!campaign) return { sent: 0, skipped: 0, failed: 0 };

    const sends = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaignSend.findMany({
        where: { orgId, campaignId, status: 'queued' },
        include: {
          account: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                  marketingSmsConsent: true,
                  marketingEmailConsent: true,
                  transactionalSmsAllowed: true,
                },
              },
            },
          },
        },
      }),
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const send of sends) {
      const customer = send.account.customer;
      try {
        const result = await this.dispatchOne(orgId, campaign, send.id, customer);
        if (result === 'sent') sent += 1;
        else if (result === 'skipped') skipped += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : 'Send failed';
        this.logger.warn({ campaignId, sendId: send.id, message }, 'Campaign send failed');
        await this.markSend(orgId, send.id, 'failed', message);
      }
    }

    const remaining = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaignSend.count({ where: { campaignId, status: 'queued' } }),
    );
    if (remaining === 0) {
      await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyCampaign.update({
          where: { id: campaignId },
          data: { status: 'completed' },
        }),
      );
    }

    return { sent, skipped, failed };
  }

  async sendToAccount(
    orgId: string,
    campaignId: string,
    accountId: string,
  ): Promise<'sent' | 'skipped' | 'failed'> {
    const campaign = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaign.findFirst({ where: { id: campaignId, orgId, status: 'active' } }),
    );
    if (!campaign) return 'skipped';

    const account = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.findFirst({
        where: { id: accountId, orgId },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              marketingSmsConsent: true,
              marketingEmailConsent: true,
              transactionalSmsAllowed: true,
            },
          },
        },
      }),
    );
    if (!account) return 'skipped';

    const send = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaignSend.create({
        data: { orgId, campaignId, accountId, status: 'queued' },
      }),
    );

    try {
      const result = await this.dispatchOne(orgId, campaign, send.id, account.customer);
      if (result === 'sent') {
        await this.prisma.withTenant(orgId, (tx) =>
          tx.loyaltyCampaign.update({
            where: { id: campaignId },
            data: { sentCount: { increment: 1 } },
          }),
        );
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      this.logger.warn({ campaignId, sendId: send.id, message }, 'Automated campaign send failed');
      await this.markSend(orgId, send.id, 'failed', message);
      return 'failed';
    }
  }

  private async dispatchOne(
    orgId: string,
    campaign: {
      id: string;
      channel: string;
      subject: string | null;
      body: string | null;
      name: string;
    },
    sendId: string,
    customer: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      marketingSmsConsent: string;
      marketingEmailConsent: string;
    },
  ): Promise<'sent' | 'skipped'> {
    const channel = campaign.channel.toUpperCase();
    const body = (campaign.body ?? '').trim() || `Message from your loyalty program.`;
    const subject = campaign.subject?.trim() || campaign.name;
    const metadata = {
      loyaltyCampaignId: campaign.id,
      loyaltyCampaignSendId: sendId,
      customerId: customer.id,
    };

    if (channel === LOYALTY_CAMPAIGN_CHANNELS.IN_APP) {
      await this.markSend(orgId, sendId, 'sent');
      return 'sent';
    }

    if (channel === LOYALTY_CAMPAIGN_CHANNELS.PUSH) {
      await this.markSend(
        orgId,
        sendId,
        'skipped',
        'Push provider not configured — use IN_APP channel',
      );
      return 'skipped';
    }

    if (channel === LOYALTY_CAMPAIGN_CHANNELS.WHATSAPP) {
      if (customer.marketingSmsConsent !== 'GRANTED') {
        await this.markSend(orgId, sendId, 'skipped', 'Marketing WhatsApp/SMS not consented');
        return 'skipped';
      }
      if (!customer.phone?.trim()) {
        await this.markSend(orgId, sendId, 'skipped', 'No phone on file');
        return 'skipped';
      }
      await this.notifications.send(orgId, {
        channel: 'whatsapp',
        to: customer.phone,
        subject,
        body,
        messageCategory: 'marketing',
        metadata,
      });
      await this.markSend(orgId, sendId, 'sent');
      return 'sent';
    }

    if (channel === LOYALTY_CAMPAIGN_CHANNELS.SMS) {
      if (customer.marketingSmsConsent !== 'GRANTED') {
        await this.markSend(orgId, sendId, 'skipped', 'Marketing SMS not consented');
        return 'skipped';
      }
      if (!customer.phone?.trim()) {
        await this.markSend(orgId, sendId, 'skipped', 'No phone on file');
        return 'skipped';
      }
      await this.notifications.send(orgId, {
        channel: 'sms',
        to: customer.phone,
        subject,
        body,
        messageCategory: 'marketing',
        metadata,
      });
      await this.markSend(orgId, sendId, 'sent');
      return 'sent';
    }

    if (channel === LOYALTY_CAMPAIGN_CHANNELS.EMAIL) {
      if (customer.marketingEmailConsent !== 'GRANTED') {
        await this.markSend(orgId, sendId, 'skipped', 'Marketing email not consented');
        return 'skipped';
      }
      if (!customer.email?.trim()) {
        await this.markSend(orgId, sendId, 'skipped', 'No email on file');
        return 'skipped';
      }
      await this.notifications.send(orgId, {
        channel: 'email',
        to: customer.email,
        subject,
        body,
        messageCategory: 'marketing',
        metadata,
      });
      await this.markSend(orgId, sendId, 'sent');
      return 'sent';
    }

    await this.markSend(orgId, sendId, 'skipped', `Unsupported channel: ${channel}`);
    return 'skipped';
  }

  private async markSend(
    orgId: string,
    sendId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyCampaignSend.update({
        where: { id: sendId },
        data: {
          status,
          sentAt: status === 'sent' ? new Date() : undefined,
          error: error ?? null,
        },
      }),
    );
  }
}
