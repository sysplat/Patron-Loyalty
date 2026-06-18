import { SYSTEM_ROLES } from '../constants/roles';

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
export function canStopQueue(
  userContext: QueueStopUserContext | string | null | undefined,
  waitingCount: number,
): boolean {
  const waiting = Number(waitingCount) > 0;

  if (typeof userContext === 'string' || userContext == null) {
    const role = String(userContext ?? '').toLowerCase();
    if (role === SYSTEM_ROLES.OWNER || role === SYSTEM_ROLES.ADMIN) return true;
    if (role === SYSTEM_ROLES.VIEWER) return false;
    if (role === SYSTEM_ROLES.MANAGER || role === SYSTEM_ROLES.STAFF) return !waiting;
    return false;
  }

  if (userContext.isOwner || userContext.isAdmin) return true;
  if (!userContext.canStopEmptyQueue) return false;
  return !waiting;
}

/** True when force-close confirmation is required before stopping a non-empty queue. */
export function queueStopRequiresForceAcknowledgement(
  userContext: QueueStopUserContext | string | null | undefined,
  waitingCount: number,
): boolean {
  return Number(waitingCount) > 0 && canStopQueue(userContext, waitingCount);
}
