import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CURRENT_PRIVACY_VERSION } from '@queueplatform/shared';
import { AuditService } from '../../common/audit/audit.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TicketCustomerConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async logSmsConsentEvent(input: {
    orgId: string;
    action: 'consent.sms.captured' | 'consent.sms.updated';
    resourceId?: string | null;
    metadata: Prisma.InputJsonObject;
  }): Promise<void> {
    const ctx = this.requestContext.getContext();
    const consentContext: Prisma.InputJsonObject = {
      ...(ctx?.ip ? { consentCaptureIp: ctx.ip } : {}),
      ...(ctx?.userAgent ? { consentCaptureUserAgent: ctx.userAgent } : {}),
    };
    await this.audit.logActivity({
      orgId: input.orgId,
      action: input.action,
      resourceType: 'customer_consent',
      resourceId: input.resourceId ?? null,
      metadata: {
        ...consentContext,
        ...input.metadata,
      },
    });
  }

  async logMarketingConsent(
    tx: Prisma.TransactionClient,
    input: {
      orgId: string;
      customerId: string;
      channel: 'sms' | 'email';
      status: 'GRANTED' | 'REVOKED';
      source: string;
      version: string;
    },
  ): Promise<void> {
    const ctx = this.requestContext.getContext();
    await tx.consentLedgerEntry.create({
      data: {
        orgId: input.orgId,
        customerId: input.customerId,
        channel: input.channel,
        purpose: 'marketing',
        action: input.status,
        source: input.source,
        legalVersion: input.version,
        ipAddress: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
      },
    });
  }

  async updateTrackPreferences(
    ticketId: string,
    data: { transactionalSmsAllowed: boolean },
  ): Promise<{ success: true }> {
    const ticket = await this.prisma.withBypassRls((tx) =>
      tx.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, orgId: true, customerId: true, transactionalSmsAllowed: true },
      }),
    );

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.transactionalSmsAllowed === data.transactionalSmsAllowed) {
      return { success: true };
    }

    await this.prisma.withTenant(ticket.orgId, async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          transactionalSmsAllowed: data.transactionalSmsAllowed,
        },
      });

      if (ticket.customerId) {
        await tx.customer.update({
          where: { id: ticket.customerId },
          data: {
            transactionalSmsAllowed: data.transactionalSmsAllowed,
          },
        });
      }
    });

    await this.logSmsConsentEvent({
      orgId: ticket.orgId,
      action: 'consent.sms.updated',
      resourceId: ticket.customerId ?? ticket.id,
      metadata: {
        source: 'track_preferences',
        policyVersion: CURRENT_PRIVACY_VERSION,
        channel: 'sms',
        purpose: 'transactional_queue_updates',
        transactionalSmsAllowed: data.transactionalSmsAllowed,
        ticketId: ticket.id,
      },
    });

    return { success: true };
  }
}
