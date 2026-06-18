import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue as BullQueue } from 'bullmq';
import {
  normalizeSmsRecipient,
  formatCustomerDeskLabel,
  decorateTransactionalSmsBody,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { NotificationSmsEntitlementService } from './notification-sms-entitlement.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationLogService } from './notification-log.service';
import { NotificationTwilioWebhookService } from './notification-twilio-webhook.service';
import { RedisService } from '../../redis/redis.service';
import { createHash } from 'crypto';

/**
 * Dispatches email/SMS notifications via BullMQ and orchestrates ticket/appointment alerts.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly templates: NotificationTemplateService;
  private readonly logs: NotificationLogService;
  private readonly twilioWebhooks: NotificationTwilioWebhookService;
  private static readonly A2P_SETTING_KEY = 'sms_a2p_registration_status';
  private static readonly A2P_UNREGISTERED_THROTTLE_KEY_PREFIX = 'sms:a2p:throttle';
  private static readonly TXN_SMS_TICKET_CAP_KEY_PREFIX = 'sms:txn:ticket';
  private static readonly TXN_SMS_APPOINTMENT_CAP_KEY_PREFIX = 'sms:txn:appointment';
  private static readonly TXN_SMS_TICKET_CAP = 3;
  private static readonly TXN_SMS_APPOINTMENT_CAP = 3;
  private static readonly TXN_SMS_CAP_TTL_SECONDS = 60 * 60 * 12;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationQueue: BullQueue,
    private readonly requestContext: RequestContextService,
    private readonly platformAudit: PlatformAuditService,
    private readonly smsEntitlement: NotificationSmsEntitlementService,
    private readonly redis: RedisService,
    templates?: NotificationTemplateService,
    logs?: NotificationLogService,
    twilioWebhooks?: NotificationTwilioWebhookService,
  ) {
    this.templates = templates ?? new NotificationTemplateService(this.prisma);
    this.logs = logs ?? new NotificationLogService(this.prisma);
    this.twilioWebhooks =
      twilioWebhooks ??
      new NotificationTwilioWebhookService(this.prisma, this.platformAudit, this.smsEntitlement);
  }

  listTemplates(orgId: string) {
    return this.templates.listTemplates(orgId);
  }

  getTemplate(orgId: string, templateId: string) {
    return this.templates.getTemplate(orgId, templateId);
  }

  createTemplate(
    orgId: string,
    data: Parameters<NotificationTemplateService['createTemplate']>[1],
  ) {
    return this.templates.createTemplate(orgId, data);
  }

  updateTemplate(
    orgId: string,
    templateId: string,
    data: Parameters<NotificationTemplateService['updateTemplate']>[2],
  ) {
    return this.templates.updateTemplate(orgId, templateId, data);
  }

  deleteTemplate(orgId: string, templateId: string) {
    return this.templates.deleteTemplate(orgId, templateId);
  }

  // ─── Sending (BullMQ Producer) ─────────────────────────

  /**
   * Validates the recipient, persists a pending `Notification` record, then
   * enqueues a `send-notification` BullMQ job for the notification worker to
   * process asynchronously.
   *
   * SMS recipients are normalized to E.164 before persistence and queueing.
   * Templates are rendered by the worker; `body` and `subject` are echoed
   * through for ad-hoc (non-template) sends.
   *
   * @throws BadRequestException when an SMS `to` address cannot be normalized to E.164.
   */
  async send(
    orgId: string,
    data: {
      channel: string;
      to: string;
      templateId?: string;
      subject?: string;
      body?: string;
      variables?: Record<string, string>;
      metadata?: Record<string, any>;
      messageCategory?: 'transactional' | 'marketing';
      recipientConsent?: {
        transactionalSmsAllowed?: boolean;
      };
      /**
       * When true, skips the `hasSmsNotifications` plan gate. Used only for
       * transactional queue SMS (ticket issued / called / almost ready) so kiosk
       * customers receive texts on every plan; marketing or dashboard-initiated
       * SMS still requires a plan that includes SMS.
       */
      skipSmsPlanGate?: boolean;
    },
  ) {
    let organizationNameForSms = 'Your organization';
    if (data.channel === 'sms') {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, website: true, country: true, industry: true },
      });
      if (!org?.name?.trim() || !org?.website || !org?.country || !org?.industry) {
        throw new BadRequestException(
          'Compliance Required: Organization profile (name, website, country, industry) must be complete to send SMS.',
        );
      }
      organizationNameForSms = org.name.trim();

      const category = data.messageCategory ?? 'transactional';
      if (category === 'transactional' && data.recipientConsent?.transactionalSmsAllowed !== true) {
        throw new BadRequestException(
          'Transactional SMS requires explicit customer consent (transactionalSmsAllowed: true).',
        );
      }
      await this.enforceA2pRegistrationPolicy(orgId, org.country ?? null);
      await this.smsEntitlement.assertCanSendSms(orgId, {
        skipPlanGate: data.skipSmsPlanGate,
      });
    }

    const requestId = this.requestContext.getRequestId();
    const recipient = data.channel === 'sms' ? normalizeSmsRecipient(data.to) : data.to.trim();
    if (!recipient) {
      throw new BadRequestException(
        'SMS recipient must be a valid E.164 phone number. Use +country code, e.g. +14155552671. US/Canada 10-digit numbers are also accepted.',
      );
    }

    // Policy Engine Guard: Verify recipient is not suppressed globally or locally
    await this.assertNotSuppressed(orgId, data.channel, recipient);
    if (data.channel === 'sms' && (data.messageCategory ?? 'transactional') === 'transactional') {
      await this.enforceTransactionalSmsFrequencyCaps(orgId, data.metadata);
    }

    const metadata = {
      ...(data.metadata ?? {}),
      ...(requestId ? { requestId } : {}),
    };
    const isTransactionalSms =
      data.channel === 'sms' && (data.messageCategory ?? 'transactional') === 'transactional';
    const renderedBody =
      isTransactionalSms && data.body
        ? decorateTransactionalSmsBody(data.body, organizationNameForSms)
        : data.body;

    // Create notification record
    const notification = await this.prisma.withTenant(orgId, (tx) =>
      tx.notification.create({
        data: {
          orgId,
          channel: data.channel,
          recipientType: 'customer',
          templateId: data.templateId,
          payload: {
            to: recipient,
            subject: data.subject,
            body: renderedBody,
            variables: data.variables ?? {},
            metadata,
          },
          status: 'pending',
        },
      }),
    );

    // Enqueue for async processing
    await this.notificationQueue.add(
      'send-notification',
      {
        notificationId: notification.id,
        orgId,
        channel: data.channel,
        to: recipient,
        templateId: data.templateId,
        subject: data.subject,
        body: renderedBody,
        variables: data.variables,
        metadata,
        requestId,
        applyTransactionalSmsFooter: isTransactionalSms,
        organizationNameForSms: isTransactionalSms ? organizationNameForSms : undefined,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    this.logger.log(
      JSON.stringify({
        notificationId: notification.id,
        channel: data.channel,
        to: recipient,
        requestId,
      }),
    );
    return notification;
  }

  private normalizeA2pStatus(raw: unknown): string {
    if (typeof raw !== 'string') return 'UNREGISTERED';
    return raw.trim().toUpperCase();
  }

  private async getOrgA2pStatus(orgId: string): Promise<string> {
    const setting = await this.prisma.withTenant(orgId, (tx) =>
      tx.setting.findFirst({
        where: { orgId, key: NotificationService.A2P_SETTING_KEY, scope: 'org' },
        select: { value: true },
      }),
    );
    if (!setting) return 'UNREGISTERED';
    if (typeof setting.value === 'string') return this.normalizeA2pStatus(setting.value);
    if (
      setting.value &&
      typeof setting.value === 'object' &&
      'status' in (setting.value as Record<string, unknown>)
    ) {
      return this.normalizeA2pStatus((setting.value as Record<string, unknown>).status);
    }
    return 'UNREGISTERED';
  }

  private async enforceA2pRegistrationPolicy(orgId: string, country: string | null): Promise<void> {
    if (country?.toUpperCase() !== 'US') return;

    const status = await this.getOrgA2pStatus(orgId);
    if (status === 'APPROVED') return;
    if (status === 'REJECTED' || status === 'SUSPENDED') {
      throw new BadRequestException(
        `SMS is blocked because your A2P registration status is ${status}. Update registration status before sending.`,
      );
    }

    // Unregistered/pending US tenants: conservative 1 SMS/second throttle.
    const throttleKey = `${NotificationService.A2P_UNREGISTERED_THROTTLE_KEY_PREFIX}:${orgId}`;
    const bucket = Math.floor(Date.now() / 1000);
    const key = `${throttleKey}:${bucket}`;
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.set(key, String(current), 2);
    }
    if (current > 1) {
      throw new BadRequestException(
        'SMS is temporarily throttled while A2P registration is pending/unregistered (max 1 message/second).',
      );
    }
  }

  private async enforceTransactionalSmsFrequencyCaps(
    orgId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const ticketId = metadata?.ticketId;
    if (typeof ticketId === 'string' && ticketId.trim().length > 0) {
      const key = `${NotificationService.TXN_SMS_TICKET_CAP_KEY_PREFIX}:${orgId}:${ticketId}`;
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.set(key, String(count), NotificationService.TXN_SMS_CAP_TTL_SECONDS);
      }
      if (count > NotificationService.TXN_SMS_TICKET_CAP) {
        throw new BadRequestException(
          `Transactional SMS cap reached for ticket ${ticketId} (max ${NotificationService.TXN_SMS_TICKET_CAP} per active ticket).`,
        );
      }
    }

    const appointmentId = metadata?.appointmentId;
    if (typeof appointmentId === 'string' && appointmentId.trim().length > 0) {
      const key = `${NotificationService.TXN_SMS_APPOINTMENT_CAP_KEY_PREFIX}:${orgId}:${appointmentId}`;
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.set(key, String(count), NotificationService.TXN_SMS_CAP_TTL_SECONDS);
      }
      if (count > NotificationService.TXN_SMS_APPOINTMENT_CAP) {
        throw new BadRequestException(
          `Transactional SMS cap reached for appointment ${appointmentId} (max ${NotificationService.TXN_SMS_APPOINTMENT_CAP} per appointment window).`,
        );
      }
    }
  }

  /**
   * Asserts that a given recipient is not suppressed on the specified channel.
   * Checks both platform-wide blocks and tenant-specific blocks.
   * Throws BadRequestException if a suppression record is found.
   */
  private async assertNotSuppressed(
    orgId: string,
    channel: string,
    recipient: string,
  ): Promise<void> {
    const pepper = process.env.ENCRYPTION_KEY;
    if (!pepper) {
      throw new BadRequestException('ENCRYPTION_KEY is not configured');
    }
    const contactHash = createHash('sha256').update(`${recipient}:${pepper}`).digest('hex');

    const suppression = await this.prisma.universalSuppression.findFirst({
      where: {
        contactHash,
        channel: channel.toUpperCase(),
        OR: [
          { orgId: null }, // Platform-wide suppression
          { orgId }, // Tenant-specific suppression
        ],
      },
    });

    if (suppression) {
      throw new BadRequestException(
        'Recipient is suppressed and cannot receive messages on this channel.',
      );
    }
  }

  /**
   * Looks up the org's notification template by event type and channel.
   * Returns the template ID if found, otherwise undefined (caller falls back to inline body).
   */
  private async findTemplateId(
    orgId: string,
    type: string,
    channel: string,
  ): Promise<string | undefined> {
    const template = await this.prisma.withTenant(orgId, (tx) =>
      tx.notificationTemplate.findFirst({
        where: { orgId, type, channel },
        select: { id: true },
      }),
    );
    return template?.id;
  }

  /**
   * Previously sent position-in-line SMS after call-next. Disabled: customers are only
   * notified when called to the desk (`notifyTicketCalled`).
   */
  async notifyTicketAlmostReady(
    _orgId: string,
    _ticketId: string,
    _position: number,
    _customerPhone?: string,
    _opts?: { servingDeskNumber?: string | null; queueName?: string | null },
  ): Promise<void> {
    return;
  }

  /**
   * Sends immediate issuance confirmation when a ticket is created from kiosk/walk-in.
   * Delivers SMS when phone exists and optional email when present.
   */
  async notifyTicketIssued(
    orgId: string,
    opts: {
      ticketId: string;
      displayNumber?: string | null;
      customerPhone?: string | null;
      customerEmail?: string | null;
      serviceName?: string | null;
      branchName?: string | null;
      transactionalSmsAllowed?: boolean;
    },
  ): Promise<void> {
    const ticket = await this.prisma.withTenant(orgId, async (tx) => {
      return tx.ticket.findUnique({
        where: { id: opts.ticketId },
        select: {
          visitId: true,
          stepIndex: true,
          branchId: true,
          queue: { select: { name: true } },
        },
      });
    });

    if (ticket?.visitId) {
      // Visit journeys: no creation SMS — customers are notified when called to the desk.
      return;
    }

    const multiStepMsg = '';

    const ticketPart = opts.displayNumber ? `Ticket ${opts.displayNumber}` : 'Ticket';
    const servicePart = opts.serviceName ? ` for ${opts.serviceName}` : '';
    const branchPart = opts.branchName ? ` at ${opts.branchName}` : '';
    const smsBody = `${ticketPart} created. We'll text when it's your turn.`;
    const emailBody = [
      `${ticketPart}${servicePart}${branchPart} has been created.`,
      multiStepMsg.trim() ? '' : null,
      multiStepMsg.trim() ? multiStepMsg.trim() : null,
      '',
      'We will notify you as your turn approaches.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    const trackingUrl = opts.ticketId
      ? `${process.env.APP_URL || 'http://localhost:3000'}/track/${opts.ticketId}`
      : '';

    const sends: Array<Promise<unknown>> = [];
    if (opts.customerPhone) {
      const templateId = await this.findTemplateId(orgId, 'ticket_created', 'sms').catch(
        () => undefined,
      );
      sends.push(
        this.send(orgId, {
          channel: 'sms',
          to: opts.customerPhone,
          templateId,
          body: smsBody,
          variables: {
            ticketId: opts.ticketId,
            displayNumber: opts.displayNumber ?? '',
            customerName: 'Customer',
            serviceName: opts.serviceName ?? 'Service',
            branchName: opts.branchName ?? 'Branch',
            estimatedWait: 'shortly',
            trackingUrl,
          },
          skipSmsPlanGate: true,
          messageCategory: 'transactional',
          metadata: { ticketId: opts.ticketId, type: 'ticket_created' },
          recipientConsent: { transactionalSmsAllowed: opts.transactionalSmsAllowed === true },
        }),
      );
    }
    if (opts.customerEmail) {
      const emailTemplateId = await this.findTemplateId(orgId, 'ticket_created', 'email').catch(
        () => undefined,
      );
      sends.push(
        this.send(orgId, {
          channel: 'email',
          to: opts.customerEmail,
          templateId: emailTemplateId,
          subject: 'Your queue ticket is confirmed',
          body: emailBody,
          variables: {
            ticketId: opts.ticketId,
            displayNumber: opts.displayNumber ?? '',
            customerName: 'Customer',
            serviceName: opts.serviceName ?? 'Service',
            branchName: opts.branchName ?? 'Branch',
            estimatedWait: 'shortly',
            trackingUrl,
          },
        }),
      );
    }
    if (sends.length > 0) {
      await Promise.allSettled(sends);
    }
  }

  /**
   * Sends an SMS to a customer when their ticket is called at a desk.
   * Silently no-ops when `opts.customerPhone` is not provided.
   * Desk and ticket display numbers are optional; the message degrades gracefully.
   */
  async notifyTicketCalled(
    orgId: string,
    ticketId: string,
    opts?: {
      displayNumber?: string;
      deskNumber?: string;
      customerPhone?: string;
      queueName?: string;
      transactionalSmsAllowed?: boolean;
    },
  ) {
    if (!opts?.customerPhone) return;

    const deskLabel = formatCustomerDeskLabel(opts?.deskNumber);
    const ticketPart = opts.displayNumber ? `Ticket #${opts.displayNumber}` : 'Your ticket';
    const queuePart = opts.queueName ? ` (${opts.queueName})` : '';
    const destination = deskLabel ?? 'the service desk';

    const templateId = await this.findTemplateId(orgId, 'ticket_called', 'sms').catch(
      () => undefined,
    );

    return this.send(orgId, {
      channel: 'sms',
      to: opts.customerPhone,
      templateId,
      body: `Your turn! ${ticketPart} to ${destination}.`,
      variables: {
        ticketId,
        displayNumber: opts.displayNumber ?? '',
        deskNumber: opts.deskNumber ?? '',
        counterNumber: opts.deskNumber ?? '',
      },
      skipSmsPlanGate: true,
      messageCategory: 'transactional',
      metadata: { ticketId, type: 'ticket_called' },
      recipientConsent: { transactionalSmsAllowed: opts.transactionalSmsAllowed === true },
    });
  }

  /**
   * Sends an SMS to a customer when their ticket is recalled at a desk.
   * Similar to notifyTicketCalled but with a "Recall" prefix.
   */
  async notifyTicketRecalled(
    orgId: string,
    ticketId: string,
    opts?: {
      displayNumber?: string;
      deskNumber?: string;
      customerPhone?: string;
      queueName?: string;
      transactionalSmsAllowed?: boolean;
      isUndo?: boolean;
    },
  ) {
    if (!opts?.customerPhone) return;

    if (opts.isUndo) {
      const ticketPart = opts.displayNumber ? ` Ticket #${opts.displayNumber}` : ' your ticket';
      return this.send(orgId, {
        channel: 'sms',
        to: opts.customerPhone,
        body: `Apologies —${ticketPart} was called in error. Please remain where you are; we will notify you when it is your turn.`,
        variables: {
          ticketId,
          displayNumber: opts.displayNumber ?? '',
        },
        skipSmsPlanGate: true,
        messageCategory: 'transactional',
        metadata: { ticketId, type: 'ticket_called_undo' },
        recipientConsent: { transactionalSmsAllowed: opts.transactionalSmsAllowed === true },
      });
    }

    const deskLabel = formatCustomerDeskLabel(opts?.deskNumber);
    const ticketPart = opts.displayNumber ? ` Ticket #${opts.displayNumber}` : '';
    const queuePart = opts.queueName ? ` (${opts.queueName})` : '';
    const destination = deskLabel ?? 'the service desk';

    const templateId = await this.findTemplateId(orgId, 'ticket_recalled', 'sms').catch(
      () => undefined,
    );

    return this.send(orgId, {
      channel: 'sms',
      to: opts.customerPhone,
      templateId,
      body: `Please return to ${destination} now.${ticketPart}${queuePart}`,
      variables: {
        ticketId,
        displayNumber: opts.displayNumber ?? '',
        deskNumber: opts.deskNumber ?? '',
        counterNumber: opts.deskNumber ?? '',
      },
      skipSmsPlanGate: true,
      messageCategory: 'transactional',
      metadata: { ticketId, type: 'ticket_recalled' },
      recipientConsent: { transactionalSmsAllowed: opts.transactionalSmsAllowed === true },
    });
  }

  /**
   * Previously sent "ready for pickup" SMS on mark-ready. Disabled: customers are only
   * notified when called to the desk (`notifyTicketCalled`).
   */
  async notifyTicketReady(
    _orgId: string,
    _ticketId: string,
    _opts?: {
      displayNumber?: string;
      customerPhone?: string;
      queueName?: string;
      transactionalSmsAllowed?: boolean;
    },
  ): Promise<void> {
    return;
  }

  /**
   * Sends an SMS confirmation to a customer when their appointment is booked.
   * Silently no-ops when `opts.customerPhone` is not provided.
   */
  async notifyAppointmentBooked(
    orgId: string,
    opts: {
      appointmentId?: string;
      customerPhone?: string;
      customerEmail?: string | null;
      customerName: string;
      serviceName: string;
      scheduledAt: Date;
      branchName?: string;
      transactionalSmsAllowed?: boolean;
    },
  ): Promise<void> {
    const time = opts.scheduledAt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const branchPart = opts.branchName ? ` at ${opts.branchName}` : '';
    const sends: Array<Promise<unknown>> = [];
    if (opts.customerPhone) {
      sends.push(
        this.send(orgId, {
          channel: 'sms',
          to: opts.customerPhone,
          body: `Hi ${opts.customerName}, your appointment for ${opts.serviceName} is confirmed${branchPart} on ${time}.`,
          variables: {
            serviceName: opts.serviceName,
            scheduledAt: time,
          },
          messageCategory: 'transactional',
          metadata: opts.appointmentId
            ? { appointmentId: opts.appointmentId, type: 'appointment_booked' }
            : { type: 'appointment_booked' },
          recipientConsent: { transactionalSmsAllowed: opts.transactionalSmsAllowed === true },
        }),
      );
    }
    if (opts.customerEmail) {
      sends.push(
        this.send(orgId, {
          channel: 'email',
          to: opts.customerEmail,
          subject: 'Appointment confirmed',
          body: `Hello ${opts.customerName},\n\nYour appointment for ${opts.serviceName}${branchPart} is confirmed for ${time}.\n\nThank you.`,
          variables: {
            serviceName: opts.serviceName,
            scheduledAt: time,
          },
        }),
      );
    }
    if (sends.length > 0) {
      await Promise.allSettled(sends);
    }
  }

  /**
   * Sends appointment reminder SMS and/or email using the platform-managed providers.
   * The caller is responsible for deduplication so reminders are only sent once.
   */
  async notifyAppointmentReminder(
    orgId: string,
    opts: {
      appointmentId: string;
      customerPhone?: string | null;
      customerEmail?: string | null;
      customerName: string;
      serviceName: string;
      scheduledAt: Date;
      branchName?: string | null;
      transactionalSmsAllowed?: boolean;
    },
  ): Promise<void> {
    const time = opts.scheduledAt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const branchPart = opts.branchName ? ` at ${opts.branchName}` : '';

    const sends: Array<Promise<unknown>> = [];

    if (opts.customerPhone) {
      sends.push(
        this.send(orgId, {
          channel: 'sms',
          to: opts.customerPhone,
          body: `Reminder: ${opts.customerName}, your ${opts.serviceName} appointment${branchPart} is on ${time}.`,
          variables: {
            appointmentId: opts.appointmentId,
            serviceName: opts.serviceName,
            scheduledAt: time,
          },
          metadata: { appointmentId: opts.appointmentId, type: 'appointment_reminder' },
          skipSmsPlanGate: true,
          messageCategory: 'transactional',
          recipientConsent: { transactionalSmsAllowed: opts.transactionalSmsAllowed === true },
        }),
      );
    }

    if (opts.customerEmail) {
      sends.push(
        this.send(orgId, {
          channel: 'email',
          to: opts.customerEmail,
          subject: `Reminder: ${opts.serviceName} appointment`,
          body: [
            `Hello ${opts.customerName},`,
            '',
            `This is a reminder for your ${opts.serviceName} appointment${branchPart}.`,
            `Time: ${time}`,
            '',
            'We look forward to seeing you.',
            '',
            '— The QlessQ Team',
          ].join('\n'),
          variables: {
            appointmentId: opts.appointmentId,
            serviceName: opts.serviceName,
            scheduledAt: time,
          },
          metadata: { appointmentId: opts.appointmentId, type: 'appointment_reminder' },
        }),
      );
    }

    await Promise.allSettled(sends);
  }

  handleTwilioStatusCallback(payload: {
    messageSid: string;
    messageStatus: string;
    errorCode?: string;
    errorMessage?: string;
  }) {
    return this.twilioWebhooks.handleTwilioStatusCallback(
      {
        sendThresholdAlert: (orgId, limit, used) => this.sendThresholdAlert(orgId, limit, used),
      },
      payload,
    );
  }

  handleInboundSms(from: string, to: string, body: string): Promise<string> {
    return this.twilioWebhooks.handleInboundSms(from, to, body);
  }

  listLogs(orgId: string, filters: Parameters<NotificationLogService['listLogs']>[1]) {
    return this.logs.listLogs(orgId, filters);
  }

  private async sendThresholdAlert(orgId: string, limit: number, used: number) {
    const adminUser =
      (await this.prisma.withTenant(orgId, (tx) =>
        tx.user.findFirst({
          where: {
            orgId,
            roleAssignments: {
              some: {
                role: {
                  name: { in: ['Owner', 'Admin'] },
                },
              },
            },
          },
          select: { email: true, firstName: true },
        }),
      )) ??
      (await this.prisma.withTenant(orgId, (tx) =>
        tx.user.findFirst({
          where: { orgId },
          orderBy: { createdAt: 'asc' },
          select: { email: true, firstName: true },
        }),
      ));

    if (!adminUser?.email) return;

    await this.send(orgId, {
      channel: 'email',
      to: adminUser.email,
      subject: 'Action Required: Low SMS Credits',
      body: `Hello ${adminUser.firstName || 'Admin'},\n\nYour organization has used ${used} of its ${limit} SMS messages (${Math.round((used / limit) * 100)}% of your total allowance). This allowance does not reset each month.\n\nBuy additional SMS packs on Billing or upgrade your plan to avoid interruption.\n\nBest regards,\nQueue Platform Team`,
    });
  }
}
