import * as Sentry from '@sentry/node';
import { applySentryPiiScrub, getObservabilityRelease } from '@queueplatform/shared';

export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN) && process.env.NODE_ENV !== 'test';
}

export function initSentry(): void {
  if (!isSentryEnabled()) return;

  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: getObservabilityRelease(),
    tracesSampleRate: isProd ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development',
    beforeSend(event) {
      return applySentryPiiScrub(event);
    },
  });
}

export function captureNotificationJobFailure(
  err: Error,
  context: {
    jobId?: string;
    notificationId?: string;
    orgId?: string;
    channel?: string;
    requestId?: string;
    attemptsMade?: number;
  },
): void {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    if (context.orgId) scope.setTag('orgId', context.orgId);
    if (context.notificationId) scope.setTag('notificationId', context.notificationId);
    if (context.channel) scope.setTag('channel', context.channel);
    if (context.requestId) scope.setTag('requestId', context.requestId);
    scope.setContext('bullmq', {
      jobId: context.jobId,
      attemptsMade: context.attemptsMade,
    });
    Sentry.captureException(err);
  });
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!isSentryEnabled()) return;
  await Sentry.flush(timeoutMs);
}
