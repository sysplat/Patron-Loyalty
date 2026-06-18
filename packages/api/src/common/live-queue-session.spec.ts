import { describe, expect, it } from 'vitest';
import {
  liveQueueBookedAtFloor,
  liveQueueWaitingIdsCacheKey,
  liveQueueWaitingTicketWhere,
  priorSessionWaitingTicketWhere,
} from './live-queue-session';

describe('live-queue-session', () => {
  it('builds waiting ticket filter for a queue session', () => {
    const floor = liveQueueBookedAtFloor('America/Vancouver', 0);
    expect(liveQueueWaitingTicketWhere('q-1', floor)).toEqual({
      queueId: 'q-1',
      status: 'waiting',
      bookedAt: { gte: floor },
    });
  });

  it('builds prior-session waiting filter', () => {
    const floor = liveQueueBookedAtFloor('UTC', 0);
    expect(priorSessionWaitingTicketWhere('b-1', floor)).toEqual({
      branchId: 'b-1',
      status: 'waiting',
      bookedAt: { lt: floor },
    });
  });

  it('uses timezone token in public track cache key', () => {
    expect(liveQueueWaitingIdsCacheKey('q-1', 'America~Vancouver')).toBe(
      'cache:q-waiting-ids:v2:q-1:America~Vancouver',
    );
  });
});
