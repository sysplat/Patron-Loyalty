export const SUPPORT_EVENTS = {
  TICKET_CREATED: 'support.ticket.created',
  TENANT_REPLIED: 'support.ticket.tenant_replied',
  OPERATOR_REPLIED: 'support.ticket.operator_replied',
} as const;

export class SupportTicketCreatedEvent {
  constructor(
    public readonly orgId: string,
    public readonly ticketId: string,
    public readonly subject: string,
    public readonly priority: string,
    public readonly category: string,
    public readonly message: string,
    public readonly actor: { email: string; firstName?: string | null; lastName?: string | null },
  ) {}
}

export class SupportTicketTenantRepliedEvent {
  constructor(
    public readonly orgId: string,
    public readonly ticketId: string,
    public readonly message: string,
    public readonly actor: { email: string; firstName?: string | null; lastName?: string | null },
  ) {}
}

export class SupportTicketOperatorRepliedEvent {
  constructor(
    public readonly orgId: string,
    public readonly ticketId: string,
    public readonly message: string,
    public readonly actor: { email?: string; firstName?: string | null; lastName?: string | null },
  ) {}
}
