"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLOVER_WEBHOOK_EVENTS = exports.SQUARE_WEBHOOK_EVENTS = exports.LOYALTY_POS_PROVIDER_VALUES = exports.LOYALTY_POS_PROVIDERS = void 0;
exports.LOYALTY_POS_PROVIDERS = {
    SQUARE: 'square',
    CLOVER: 'clover',
};
exports.LOYALTY_POS_PROVIDER_VALUES = Object.values(exports.LOYALTY_POS_PROVIDERS);
/** Square webhook event types we handle */
exports.SQUARE_WEBHOOK_EVENTS = {
    PAYMENT_CREATED: 'payment.created',
    PAYMENT_UPDATED: 'payment.updated',
    CUSTOMER_CREATED: 'customer.created',
};
/** Clover webhook event types we handle */
exports.CLOVER_WEBHOOK_EVENTS = {
    /** Fired when an order is created/updated — we check for PAID status */
    CREATE_ORDER: 'CREATE:ORDER',
    UPDATE_ORDER: 'UPDATE:ORDER',
    CREATE_CUSTOMER: 'CREATE:CUSTOMER',
};
//# sourceMappingURL=loyalty-pos.js.map