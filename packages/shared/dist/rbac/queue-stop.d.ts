export interface QueueStopUserContext {
    isOwner: boolean;
    isAdmin: boolean;
    /** Manager/staff with queue manage or update; never viewer (read-only). */
    canStopEmptyQueue: boolean;
}
/**
 * Whether a user may stop (close) a queue.
 * - Owner and admin: always (including while customers are waiting; caller must confirm force close).
 * - Manager and staff: only when the waiting list is empty.
 * - Viewer: never.
 */
export declare function canStopQueue(userContext: QueueStopUserContext | string | null | undefined, waitingCount: number): boolean;
/** True when force-close confirmation is required before stopping a non-empty queue. */
export declare function queueStopRequiresForceAcknowledgement(userContext: QueueStopUserContext | string | null | undefined, waitingCount: number): boolean;
//# sourceMappingURL=queue-stop.d.ts.map