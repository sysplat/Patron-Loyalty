"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QLESSQ_QUEUE_INTEGRATION_EVENT_VALUES = exports.QLESSQ_QUEUE_INTEGRATION_EVENTS = exports.PATRON_LOYALTY_INTEGRATION_TYPE = exports.QLESSQ_CONNECTOR_VERSION = void 0;
/** Current QlessQ → LMS connector payload version (forward-compatible evolution). */
exports.QLESSQ_CONNECTOR_VERSION = 1;
exports.PATRON_LOYALTY_INTEGRATION_TYPE = 'patron_loyalty';
/** Normalized queue → LMS event names (HTTP connector contract). */
exports.QLESSQ_QUEUE_INTEGRATION_EVENTS = {
    TICKET_COMPLETED: 'ticket.completed',
    TICKET_NO_SHOW: 'ticket.no_show',
    APPOINTMENT_COMPLETED: 'appointment.completed',
    APPOINTMENT_NO_SHOW: 'appointment.no_show',
    REVIEW_SUBMITTED: 'review.submitted',
    CUSTOMER_CREATED: 'customer.created',
};
exports.QLESSQ_QUEUE_INTEGRATION_EVENT_VALUES = Object.values(exports.QLESSQ_QUEUE_INTEGRATION_EVENTS);
//# sourceMappingURL=loyalty-connector.js.map