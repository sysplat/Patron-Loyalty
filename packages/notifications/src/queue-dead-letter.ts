import type { Job, Queue } from 'bullmq';

export const NOTIFICATIONS_QUEUE_NAME = 'notifications';
export const NOTIFICATIONS_DEAD_QUEUE_NAME = 'notifications-dead';
export const DEFAULT_NOTIFICATION_JOB_ATTEMPTS = 3;

export function resolveMaxJobAttempts(job: Pick<Job, 'opts'>): number {
  return job.opts?.attempts ?? DEFAULT_NOTIFICATION_JOB_ATTEMPTS;
}

export function isNotificationJobExhausted(job: Pick<Job, 'attemptsMade' | 'opts'>): boolean {
  return job.attemptsMade >= resolveMaxJobAttempts(job);
}

export function buildNotificationDeadLetterPayload(
  job: Pick<Job, 'id' | 'data' | 'attemptsMade'>,
  err: Error,
) {
  return {
    ...job.data,
    originalJobId: job.id,
    failedReason: err.message,
    failedAt: new Date().toISOString(),
    attemptsMade: job.attemptsMade,
  };
}

export async function copyExhaustedNotificationJobToDeadLetter(
  deadLetterQueue: Queue,
  job: Job,
  err: Error,
): Promise<boolean> {
  if (!isNotificationJobExhausted(job)) {
    return false;
  }

  await deadLetterQueue.add('exhausted', buildNotificationDeadLetterPayload(job, err), {
    removeOnComplete: { count: 2_000 },
    removeOnFail: { count: 500 },
  });

  return true;
}
