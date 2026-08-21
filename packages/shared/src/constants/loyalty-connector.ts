/** Current QPlatform → LMS connector payload version (forward-compatible evolution). */
export const QPLATFORM_CONNECTOR_VERSION = 1 as const;

export const PATRON_LOYALTY_INTEGRATION_TYPE = 'patron_loyalty' as const;

/** Normalized queue → LMS event names (HTTP connector contract). */
export const QPLATFORM_QUEUE_INTEGRATION_EVENTS = {
  TICKET_COMPLETED: 'ticket.completed',
  TICKET_NO_SHOW: 'ticket.no_show',
  APPOINTMENT_COMPLETED: 'appointment.completed',
  APPOINTMENT_NO_SHOW: 'appointment.no_show',
  REVIEW_SUBMITTED: 'review.submitted',
  CUSTOMER_CREATED: 'customer.created',
} as const;

export type QPlatformQueueIntegrationEvent =
  (typeof QPLATFORM_QUEUE_INTEGRATION_EVENTS)[keyof typeof QPLATFORM_QUEUE_INTEGRATION_EVENTS];

export const QPLATFORM_QUEUE_INTEGRATION_EVENT_VALUES = Object.values(
  QPLATFORM_QUEUE_INTEGRATION_EVENTS,
) as [QPlatformQueueIntegrationEvent, ...QPlatformQueueIntegrationEvent[]];

/** Per-org link stored on QPlatform `integrations.config` when LMS is a separate deploy. */
export type PatronLoyaltyIntegrationConfig = {
  /** LMS organization id (informational; API key scopes requests on LMS). */
  lmsOrgId?: string;
  /** LMS REST base including `/api/v1`, e.g. https://pl-api.example.com/api/v1 */
  apiBaseUrl?: string;
  /** LMS Integration API key (`X-Loyalty-Api-Key`). */
  apiKey: string;
};
