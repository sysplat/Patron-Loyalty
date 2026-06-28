"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_PRODUCT_API_PREFIXES = void 0;
exports.isQueueProductApiPath = isQueueProductApiPath;
/** First URI segment after `/api/v1/` for queue-management (QMS) routes. */
exports.QUEUE_PRODUCT_API_PREFIXES = [
    'branches',
    'services',
    'queues',
    'flow-templates',
    'guided-setup',
    'tickets',
    'service-queue',
    'visits',
    'desks',
    'display',
    'appointments',
    'announcements',
    'reviews',
    'workbench',
    'station-profiles',
    'agent-sessions',
    'reports',
    'realtime',
];
function isQueueProductApiPath(path) {
    const normalized = path.toLowerCase();
    const match = normalized.match(/\/api\/v\d+\/([^/?]+)/);
    if (!match)
        return false;
    return exports.QUEUE_PRODUCT_API_PREFIXES.includes(match[1]);
}
//# sourceMappingURL=queue-product-api.js.map