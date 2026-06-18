import { describe, expect, it, vi } from 'vitest';
import type { Job, Queue } from 'bullmq';
import {
  buildNotificationDeadLetterPayload,
  copyExhaustedNotificationJobToDeadLetter,
  isNotificationJobExhausted,
  resolveMaxJobAttempts,
} from './queue-dead-letter';

function jobStub(overrides: Partial<Pick<Job, 'id' | 'data' | 'attemptsMade' | 'opts'>> = {}): Job {
  return {
    id: 'job-1',
    data: { notificationId: 'notif-1', orgId: 'org-1', channel: 'email' },
    attemptsMade: 3,
    opts: { attempts: 3 },
    ...overrides,
  } as Job;
}

describe('queue-dead-letter', () => {
  it('resolves max attempts with default fallback', () => {
    expect(resolveMaxJobAttempts(jobStub({ opts: { attempts: 5 } }))).toBe(5);
    expect(resolveMaxJobAttempts(jobStub({ opts: {} }))).toBe(3);
  });

  it('detects exhausted jobs', () => {
    expect(isNotificationJobExhausted(jobStub({ attemptsMade: 2, opts: { attempts: 3 } }))).toBe(
      false,
    );
    expect(isNotificationJobExhausted(jobStub({ attemptsMade: 3, opts: { attempts: 3 } }))).toBe(
      true,
    );
  });

  it('builds dead-letter payload with failure metadata', () => {
    const payload = buildNotificationDeadLetterPayload(
      jobStub(),
      new Error('Provider unavailable'),
    );

    expect(payload.notificationId).toBe('notif-1');
    expect(payload.originalJobId).toBe('job-1');
    expect(payload.failedReason).toBe('Provider unavailable');
    expect(payload.attemptsMade).toBe(3);
    expect(typeof payload.failedAt).toBe('string');
  });

  it('copies exhausted jobs to dead-letter queue only after final attempt', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const deadLetterQueue = { add } as unknown as Queue;

    const copied = await copyExhaustedNotificationJobToDeadLetter(
      deadLetterQueue,
      jobStub({ attemptsMade: 2, opts: { attempts: 3 } }),
      new Error('retry'),
    );
    expect(copied).toBe(false);
    expect(add).not.toHaveBeenCalled();

    const copiedFinal = await copyExhaustedNotificationJobToDeadLetter(
      deadLetterQueue,
      jobStub({ attemptsMade: 3, opts: { attempts: 3 } }),
      new Error('exhausted'),
    );
    expect(copiedFinal).toBe(true);
    expect(add).toHaveBeenCalledWith(
      'exhausted',
      expect.objectContaining({
        notificationId: 'notif-1',
        originalJobId: 'job-1',
        failedReason: 'exhausted',
        attemptsMade: 3,
      }),
      expect.objectContaining({ removeOnComplete: { count: 2_000 } }),
    );
  });
});
