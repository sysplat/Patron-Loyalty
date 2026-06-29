/** Current QlessQ → LMS connector payload version (forward-compatible evolution). */
export declare const QLESSQ_CONNECTOR_VERSION: 1;
export declare const PATRON_LOYALTY_INTEGRATION_TYPE: "patron_loyalty";
/** Normalized queue → LMS event names (HTTP connector contract). */
export declare const QLESSQ_QUEUE_INTEGRATION_EVENTS: {
    readonly TICKET_COMPLETED: "ticket.completed";
    readonly TICKET_NO_SHOW: "ticket.no_show";
    readonly APPOINTMENT_COMPLETED: "appointment.completed";
    readonly APPOINTMENT_NO_SHOW: "appointment.no_show";
    readonly REVIEW_SUBMITTED: "review.submitted";
    readonly CUSTOMER_CREATED: "customer.created";
};
export type QlessqQueueIntegrationEvent = (typeof QLESSQ_QUEUE_INTEGRATION_EVENTS)[keyof typeof QLESSQ_QUEUE_INTEGRATION_EVENTS];
export declare const QLESSQ_QUEUE_INTEGRATION_EVENT_VALUES: [QlessqQueueIntegrationEvent, ...QlessqQueueIntegrationEvent[]];
/** Per-org link stored on QlessQ `integrations.config` when LMS is a separate deploy. */
export type PatronLoyaltyIntegrationConfig = {
    /** LMS organization id (informational; API key scopes requests on LMS). */
    lmsOrgId?: string;
    /** LMS REST base including `/api/v1`, e.g. https://pl-api.example.com/api/v1 */
    apiBaseUrl?: string;
    /** LMS Integration API key (`X-Loyalty-Api-Key`). */
    apiKey: string;
};
//# sourceMappingURL=loyalty-connector.d.ts.map