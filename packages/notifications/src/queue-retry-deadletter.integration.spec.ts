import { describe, expect, it } from 'vitest';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import {
  NOTIFICATIONS_DEAD_QUEUE_NAME,
  buildNotificationDeadLetterPayload,
  copyExhaustedNotificationJobToDeadLetter,
  isNotificationJobExhausted,
} from './queue-dead-letter';

const redisUrl = process.env.REDIS_URL;

describe.skipIf(!redisUrl)('notifications queue retry/dead-letter', () => {
  it('moves exhausted jobs to dead-letter queue using worker dead-letter contract', async () => {
    const connection = new IORedis(redisUrl!, { maxRetriesPerRequest: null });
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const queueName = `notifications-smoke-${suffix}`;
    const deadQueueName = `${NOTIFICATIONS_DEAD_QUEUE_NAME}-smoke-${suffix}`;

    const queue = new Queue(queueName, { connection });
    const deadQueue = new Queue(deadQueueName, { connection });

    const worker = new Worker(
      queueName,
      async () => {
        throw new Error('forced-failure');
      },
      {
        connection,
        concurrency: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    );

    worker.on('failed', async (job, err) => {
      if (!job) return;
      await copyExhaustedNotificationJobToDeadLetter(deadQueue, job, err);
    });

    try {
      await queue.add(
        'send',
        { notificationId: `notif-${suffix}`, orgId: 'org-smoke', channel: 'email' },
        { attempts: 3, backoff: { type: 'fixed', delay: 10 } },
      );

      let deadCount = 0;
      for (let i = 0; i < 80; i++) {
        deadCount = await deadQueue.count();
        if (deadCount > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(deadCount).toBeGreaterThan(0);
      const jobs = await deadQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].data.originalJobId).toBeTruthy();
      expect(jobs[0].data.attemptsMade).toBe(3);
      expect(jobs[0].data.failedReason).toBe('forced-failure');
      expect(isNotificationJobExhausted({ attemptsMade: 3, opts: { attempts: 3 } })).toBe(true);
      expect(
        buildNotificationDeadLetterPayload(
          {
            id: jobs[0].data.originalJobId,
            data: jobs[0].data,
            attemptsMade: 3,
          },
          new Error('forced-failure'),
        ).notificationId,
      ).toBe(`notif-${suffix}`);
    } finally {
      await worker.close();
      await queue.obliterate({ force: true }).catch(() => {});
      await deadQueue.obliterate({ force: true }).catch(() => {});
      await queue.close();
      await deadQueue.close();
      await connection.quit();
    }
  }, 20000);
});
