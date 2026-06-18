"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canStopQueue = canStopQueue;
exports.queueStopRequiresForceAcknowledgement = queueStopRequiresForceAcknowledgement;
const roles_1 = require("../constants/roles");
/**
 * Whether a user may stop (close) a queue.
 * - Owner and admin: always (including while customers are waiting; caller must confirm force close).
 * - Manager and staff: only when the waiting list is empty.
 * - Viewer: never.
 */
function canStopQueue(userContext, waitingCount) {
    const waiting = Number(waitingCount) > 0;
    if (typeof userContext === 'string' || userContext == null) {
        const role = String(userContext ?? '').toLowerCase();
        if (role === roles_1.SYSTEM_ROLES.OWNER || role === roles_1.SYSTEM_ROLES.ADMIN)
            return true;
        if (role === roles_1.SYSTEM_ROLES.VIEWER)
            return false;
        if (role === roles_1.SYSTEM_ROLES.MANAGER || role === roles_1.SYSTEM_ROLES.STAFF)
            return !waiting;
        return false;
    }
    if (userContext.isOwner || userContext.isAdmin)
        return true;
    if (!userContext.canStopEmptyQueue)
        return false;
    return !waiting;
}
/** True when force-close confirmation is required before stopping a non-empty queue. */
function queueStopRequiresForceAcknowledgement(userContext, waitingCount) {
    return Number(waitingCount) > 0 && canStopQueue(userContext, waitingCount);
}
//# sourceMappingURL=queue-stop.js.map