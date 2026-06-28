/** First URI segment after `/api/v1/` for queue-management (QMS) routes. */
export declare const QUEUE_PRODUCT_API_PREFIXES: readonly ["branches", "services", "queues", "flow-templates", "guided-setup", "tickets", "service-queue", "visits", "desks", "display", "appointments", "announcements", "reviews", "workbench", "station-profiles", "agent-sessions", "reports", "realtime"];
export type QueueProductApiPrefix = (typeof QUEUE_PRODUCT_API_PREFIXES)[number];
export declare function isQueueProductApiPath(path: string): boolean;
//# sourceMappingURL=queue-product-api.d.ts.map