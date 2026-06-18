import { LOYALTY_EVENTS } from '@queueplatform/shared';

export class LoyaltyTicketCompletedEvent {
  constructor(
    public readonly orgId: string,
    public readonly ticketId: string,
    public readonly customerId: string | null,
    public readonly branchId: string,
    public readonly serviceId: string | null,
  ) {}
}

export class LoyaltyAppointmentCompletedEvent {
  constructor(
    public readonly orgId: string,
    public readonly appointmentId: string,
    public readonly customerId: string | null,
    public readonly branchId: string,
    public readonly customerPhone?: string | null,
    public readonly customerEmail?: string | null,
  ) {}
}

export class LoyaltyReviewSubmittedEvent {
  constructor(
    public readonly orgId: string,
    public readonly reviewId: string,
    public readonly customerId: string | null,
    public readonly rating: number,
  ) {}
}

export class LoyaltyCustomerCreatedEvent {
  constructor(
    public readonly orgId: string,
    public readonly customerId: string,
  ) {}
}

export class LoyaltyTicketNoShowEvent {
  constructor(
    public readonly orgId: string,
    public readonly ticketId: string,
    public readonly customerId: string | null,
    public readonly branchId: string,
  ) {}
}

export class LoyaltyAppointmentNoShowEvent {
  constructor(
    public readonly orgId: string,
    public readonly appointmentId: string,
    public readonly customerId: string | null,
    public readonly branchId: string,
    public readonly customerPhone?: string | null,
    public readonly customerEmail?: string | null,
  ) {}
}

export { LOYALTY_EVENTS };
