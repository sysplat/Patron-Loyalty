import type { Prisma } from '@prisma/client';
import { cacheTokenForZone, orgLocalStartOfDayMinusDaysUtc } from './org-local-dates';

/** Active statuses shown on agent consoles and public track (non-journey). */
export const LIVE_QUEUE_ACTIVE_STATUSES = ['waiting', 'called', 'serving'] as const;

/**
 * Start of the operational queue session in branch-local time (default: today 00:00).
 * Tickets booked before this are "prior session" — excluded from live lines and track position.
 */
export function liveQueueBookedAtFloor(ianaZone: string, daysBeforeToday = 0): Date {
  return orgLocalStartOfDayMinusDaysUtc(ianaZone, daysBeforeToday);
}

export function liveQueueWaitingTicketWhere(
  queueId: string,
  bookedAtFloor: Date,
): Prisma.TicketWhereInput {
  return {
    queueId,
    status: 'waiting',
    bookedAt: { gte: bookedAtFloor },
  };
}

export function liveQueueActiveTicketWhere(
  queueId: string,
  bookedAtFloor: Date,
): Prisma.TicketWhereInput {
  return {
    queueId,
    status: { in: [...LIVE_QUEUE_ACTIVE_STATUSES] },
    bookedAt: { gte: bookedAtFloor },
  };
}

export function liveQueueWaitingIdsCacheKey(queueId: string, tzToken: string): string {
  return `cache:q-waiting-ids:v2:${queueId}:${tzToken}`;
}

export function branchWaitingCountWhere(
  branchId: string,
  bookedAtFloor: Date,
): Prisma.TicketWhereInput {
  return {
    branchId,
    status: 'waiting',
    bookedAt: { gte: bookedAtFloor },
  };
}

export function priorSessionWaitingTicketWhere(
  branchId: string,
  bookedAtFloor: Date,
): Prisma.TicketWhereInput {
  return {
    branchId,
    status: 'waiting',
    bookedAt: { lt: bookedAtFloor },
  };
}
