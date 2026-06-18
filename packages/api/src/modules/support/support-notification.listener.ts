import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  SUPPORT_EVENTS,
  SupportTicketCreatedEvent,
  SupportTicketTenantRepliedEvent,
  SupportTicketOperatorRepliedEvent,
} from './support.events';
import { DEFAULT_SUPPORT_EMAIL } from '@queueplatform/shared';

@Injectable()
export class SupportNotificationListener {
  private readonly logger = new Logger(SupportNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private getPlatformSupportEmail(): string {
    return (process.env.SUPPORT_CONTACT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim();
  }

  @OnEvent(SUPPORT_EVENTS.TICKET_CREATED, { async: true })
  async handleTicketCreated(event: SupportTicketCreatedEvent) {
    if (process.env.SUPPORT_EMAIL_NOTIFICATIONS_ENABLED === 'false') return;

    const to = this.getPlatformSupportEmail();
    const fullName =
      [event.actor.firstName, event.actor.lastName].filter(Boolean).join(' ').trim() ||
      event.actor.email;

    try {
      await this.notifications.send(event.orgId, {
        channel: 'email',
        to,
        subject: `[QMS Support] ${event.subject}`,
        body: [
          `Ticket ID: ${event.ticketId}`,
          `Organization: ${event.orgId}`,
          `Requested by: ${fullName} <${event.actor.email}>`,
          `Priority: ${event.priority}`,
          `Category: ${event.category}`,
          '',
          event.message,
        ].join('\n'),
      });
    } catch (error) {
      this.logger.error(`Failed to send ticket creation email: ${error}`);
    }
  }

  @OnEvent(SUPPORT_EVENTS.TENANT_REPLIED, { async: true })
  async handleTenantReplied(event: SupportTicketTenantRepliedEvent) {
    if (process.env.SUPPORT_EMAIL_NOTIFICATIONS_ENABLED === 'false') return;

    const to = this.getPlatformSupportEmail();
    const fullName =
      [event.actor.firstName, event.actor.lastName].filter(Boolean).join(' ').trim() ||
      event.actor.email;

    try {
      await this.notifications.send(event.orgId, {
        channel: 'email',
        to,
        subject: `[QMS Support Reply] Ticket ${event.ticketId}`,
        body: [
          `New reply from tenant user: ${fullName} <${event.actor.email}>`,
          `Organization: ${event.orgId}`,
          '',
          event.message,
        ].join('\n'),
      });
    } catch (error) {
      this.logger.error(`Failed to send tenant reply email: ${error}`);
    }
  }

  @OnEvent(SUPPORT_EVENTS.OPERATOR_REPLIED, { async: true })
  async handleOperatorReplied(event: SupportTicketOperatorRepliedEvent) {
    if (process.env.SUPPORT_EMAIL_NOTIFICATIONS_ENABLED === 'false') return;

    try {
      const ticket = await this.prisma.withTenant(event.orgId, (tx) =>
        tx.supportRequest.findUnique({
          where: { id: event.ticketId },
          include: {
            createdBy: true,
            contact: true,
            messages: { where: { isOrgInternal: false }, include: { author: true } },
          },
        }),
      );

      if (!ticket) return;

      const recipients = new Set<string>();

      // 1. Assigned org contact (primary)
      if (ticket.contact?.email) {
        recipients.add(ticket.contact.email);
      }

      // 2. All owners and admins (oversight)
      const leaders = await this.prisma.withTenant(event.orgId, (tx) =>
        tx.user.findMany({
          where: {
            orgId: event.orgId,
            status: 'active',
            emailVerified: true,
            roleAssignments: {
              some: {
                role: {
                  orgId: event.orgId,
                  name: { in: ['owner', 'admin'] },
                },
              },
            },
          },
          select: { email: true },
        }),
      );
      leaders.forEach((u) => u.email && recipients.add(u.email));

      // Dispatch to everyone
      await Promise.allSettled(
        Array.from(recipients).map((to) =>
          this.notifications.send(event.orgId, {
            channel: 'email',
            to,
            subject: `Re: [QMS Support] ${ticket.subject}`,
            body: [
              'QlessQ Support has replied to your ticket:',
              '',
              event.message,
              '',
              '---',
              'Open your dashboard under Support to view the full thread.',
            ].join('\n'),
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`Failed to send operator reply email: ${error}`);
    }
  }
}
