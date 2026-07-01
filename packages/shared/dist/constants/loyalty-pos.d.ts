export declare const LOYALTY_POS_PROVIDERS: {
    readonly SQUARE: "square";
    readonly CLOVER: "clover";
};
export type LoyaltyPosProvider = (typeof LOYALTY_POS_PROVIDERS)[keyof typeof LOYALTY_POS_PROVIDERS];
export declare const LOYALTY_POS_PROVIDER_VALUES: LoyaltyPosProvider[];
/** Square webhook event types we handle */
export declare const SQUARE_WEBHOOK_EVENTS: {
    readonly PAYMENT_CREATED: "payment.created";
    readonly PAYMENT_UPDATED: "payment.updated";
    readonly CUSTOMER_CREATED: "customer.created";
};
/** Clover webhook event types we handle */
export declare const CLOVER_WEBHOOK_EVENTS: {
    /** Fired when an order is created/updated — we check for PAID status */
    readonly CREATE_ORDER: "CREATE:ORDER";
    readonly UPDATE_ORDER: "UPDATE:ORDER";
    readonly CREATE_CUSTOMER: "CREATE:CUSTOMER";
};
//# sourceMappingURL=loyalty-pos.d.ts.map