import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CURRENT_PRIVACY_VERSION, normalizeSmsRecipient } from '@queueplatform/shared';
import { createHash } from 'crypto';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationSmsEntitlementService } from './notification-sms-entitlement.service';

export type NotificationTwilioWebhookHost = {
  sendThresholdAlert: (orgId: string, limit: number, used: number) => Promise<void>;
};

@Injectable()
export class NotificationTwilioWebhookService {
  private readonly logger = new Logger(NotificationTwilioWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
    private readonly smsEntitlement: NotificationSmsEntitlementService,
  ) {}

  async handleTwilioStatusCallback(
    host: NotificationTwilioWebhookHost,
    payload: {
      messageSid: string;
      messageStatus: string;
      errorCode?: string;
      errorMessage?: string;
    },
  ) {
    const notification = await this.prisma.withBypassRls((tx) =>
      tx.notification.findFirst({
        where: { providerMessageId: payload.messageSid },
      }),
    );

    if (!notification) {
      this.logger.warn(
        { messageSid: payload.messageSid },
        'Twilio callback for unknown notification (no record found)',
      );
      return;
    }

    const statusMap: Record<string, string> = {
      delivered: 'delivered',
      read: 'delivered',
      failed: 'failed',
      undelivered: 'failed',
    };
    const internalStatus = statusMap[payload.messageStatus];
    const errorText = payload.errorCode
      ? `Twilio ${payload.messageStatus} — code ${payload.errorCode}${payload.errorMessage ? ': ' + payload.errorMessage : ''}`
      : undefined;

    if (internalStatus) {
      await this.prisma.withBypassRls((tx) =>
        tx.notification.update({
          where: { id: notification.id },
          data: {
            status: internalStatus,
            ...(errorText ? { errorMessage: errorText } : {}),
          },
        }),
      );
    }

    await this.prisma.withBypassRls((tx) =>
      tx.notificationLog.create({
        data: {
          notificationId: notification.id,
          event: payload.messageStatus,
          metadata: {
            messageSid: payload.messageSid,
            ...(payload.errorCode
              ? { errorCode: payload.errorCode, errorMessage: payload.errorMessage }
              : {}),
          },
        },
      }),
    );

    if (payload.messageStatus === 'sent' || payload.messageStatus === 'delivered') {
      const usage = await this.smsEntitlement.snapshotUsageAfterDelivery(notification.orgId);
      if (usage.atNinetyPercentThreshold) {
        host
          .sendThresholdAlert(notification.orgId, usage.effectiveLimit, usage.used)
          .catch((err) => {
            this.logger.error(
              `Failed to send SMS threshold alert for org ${notification.orgId}`,
              err,
            );
          });
      }
    }

    if (internalStatus === 'failed') {
      await this.smsEntitlement.syncUsageAfterFailedDelivery(notification.orgId);
    }

    this.logger.log(
      { notificationId: notification.id, twilioStatus: payload.messageStatus },
      'Twilio status callback processed',
    );
  }

  async handleInboundSms(from: string, to: string, body: string): Promise<string> {
    const normalizedFrom = normalizeSmsRecipient(from);
    if (!normalizedFrom) {
      this.logger.warn({ from, body }, 'Received inbound SMS with invalid sender format');
      return '<Response></Response>';
    }

    const text = body.trim().toUpperCase();
    const isOptOut = ['STOP', 'UNSUBSCRIBE', 'ARRET', 'QUIT', 'CANCEL'].includes(text);
    const isOptIn = ['START', 'UNSTOP'].includes(text);
    const isHelp = text === 'HELP';

    if (isHelp) {
      return '<Response><Message>QlessQ alerts: reply STOP (or ARRET) to opt out, START to opt back in. For assistance, contact the organization that invited you to this queue.</Message></Response>';
    }

    if (!isOptOut && !isOptIn) {
      return '<Response></Response>';
    }

    const pepper = process.env.ENCRYPTION_KEY;
    if (!pepper) {
      throw new BadRequestException('ENCRYPTION_KEY is not configured');
    }
    const contactHash = createHash('sha256').update(`${normalizedFrom}:${pepper}`).digest('hex');

    if (isOptOut) {
      const existing = await this.prisma.universalSuppression.findFirst({
        where: { orgId: null, contactHash, channel: 'SMS' },
      });
      if (existing) {
        await this.prisma.universalSuppression.update({
          where: { id: existing.id },
          data: {
            source: 'WEBHOOK_STOP',
            reason: `User sent ${text} keyword via SMS`,
            createdAt: new Date(),
          },
        });
      } else {
        await this.prisma.universalSuppression.create({
          data: {
            orgId: null,
            contactHash,
            channel: 'SMS',
            source: 'WEBHOOK_STOP',
            reason: `User sent ${text} keyword via SMS`,
          },
        });
      }

      await this.syncSmsConsentByPhone(normalizedFrom, false);

      this.logger.log({ contactHash, keyword: text }, 'Processed inbound SMS opt-out');
      await this.platformAudit.log({
        eventType: 'consent.sms.updated',
        severity: 'info',
        subjectOrgId: null,
        metadata: {
          source: 'inbound_webhook',
          channel: 'sms',
          purpose: 'transactional',
          action: 'opt_out',
          keyword: text,
          contactHash,
          policyVersion: CURRENT_PRIVACY_VERSION,
        },
      });
      return '<Response><Message>You have been opted out of QMS updates. No more messages will be sent. Reply START to join again.</Message></Response>';
    }

    await this.prisma.universalSuppression.deleteMany({
      where: {
        orgId: null,
        contactHash,
        channel: 'SMS',
      },
    });

    await this.syncSmsConsentByPhone(normalizedFrom, true);

    this.logger.log({ contactHash, keyword: text }, 'Processed inbound SMS opt-in');
    await this.platformAudit.log({
      eventType: 'consent.sms.updated',
      severity: 'info',
      subjectOrgId: null,
      metadata: {
        source: 'inbound_webhook',
        channel: 'sms',
        purpose: 'transactional',
        action: 'opt_in',
        keyword: text,
        contactHash,
        policyVersion: CURRENT_PRIVACY_VERSION,
      },
    });
    return '<Response><Message>You have successfully re-subscribed to QMS updates.</Message></Response>';
  }

  private async syncSmsConsentByPhone(
    phone: string,
    transactionalSmsAllowed: boolean,
  ): Promise<void> {
    await this.prisma.withBypassRls(async (tx) => {
      await tx.customer.updateMany({
        where: { phone },
        data: { transactionalSmsAllowed },
      });
      await tx.ticket.updateMany({
        where: {
          customerPhone: phone,
          status: { in: ['waiting', 'called', 'serving'] },
        },
        data: { transactionalSmsAllowed },
      });
    });
  }
}
