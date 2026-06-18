import { Logger } from '@nestjs/common';

type TransactionalSmsTicket = {
  id: string;
  customerPhone?: string | null;
  displayNumber?: string | null;
  deskNumber?: string | null;
  transactionalSmsAllowed?: boolean | null;
  queue?: { name?: string | null } | null;
};

export function canSendTransactionalSms(ticket: {
  customerPhone?: string | null;
  transactionalSmsAllowed?: boolean | null;
}): boolean {
  return Boolean(ticket.customerPhone) && ticket.transactionalSmsAllowed === true;
}

export function emitTicketCalledNotification(
  notifications: {
    notifyTicketCalled: (
      orgId: string,
      ticketId: string,
      opts: {
        displayNumber?: string;
        deskNumber?: string;
        customerPhone?: string;
        queueName?: string;
        transactionalSmsAllowed?: boolean;
      },
    ) => Promise<unknown>;
  },
  logger: Logger,
  orgId: string,
  ticket: TransactionalSmsTicket,
  deskNumberOverride?: string,
): void {
  if (!canSendTransactionalSms(ticket)) return;

  notifications
    .notifyTicketCalled(orgId, ticket.id, {
      displayNumber: ticket.displayNumber ?? undefined,
      deskNumber: (ticket.deskNumber ?? deskNumberOverride) || undefined,
      customerPhone: ticket.customerPhone ?? undefined,
      queueName: ticket.queue?.name ?? undefined,
      transactionalSmsAllowed: ticket.transactionalSmsAllowed ?? undefined,
    })
    .catch((error: Error) =>
      logger.warn(`SMS notification failed for ticket ${ticket.id}: ${error.message}`),
    );
}
