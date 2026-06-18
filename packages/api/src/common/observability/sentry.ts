import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import {
  applySentryPiiScrub,
  getObservabilityRelease,
  isJourneyCompleteErrorCode,
  journeyCompleteErrorFingerprint,
  type JourneyCompleteFailureDetails,
} from '@queueplatform/shared';
import type { RequestContextData } from '../request-context/request-context.service';

const PRISMA_SYSTEM_FAILURE_CODES = new Set(['P2022']);

export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN) && process.env.NODE_ENV !== 'test';
}

export function initSentry(): void {
  if (!isSentryEnabled()) return;

  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: getObservabilityRelease(),
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: isProd ? 0.1 : 1.0,
    profilesSampleRate: isProd ? 0.1 : 1.0,
    environment: process.env.NODE_ENV || 'development',
    beforeSend(event) {
      return applySentryPiiScrub(event);
    },
  });
}

export function syncSentryRequestContext(
  ctx: (RequestContextData & { userId?: string; email?: string }) | undefined,
): void {
  if (!isSentryEnabled() || !ctx) return;

  if (ctx.userId) {
    Sentry.setUser({
      id: ctx.userId,
      ...(ctx.email ? { email: ctx.email } : {}),
    });
  }

  if (ctx.orgId) Sentry.setTag('orgId', ctx.orgId);
  if (ctx.queueId) Sentry.setTag('queueId', ctx.queueId);
  if (ctx.ticketId) Sentry.setTag('ticketId', ctx.ticketId);
  if (ctx.requestId) Sentry.setTag('requestId', ctx.requestId);

  Sentry.setContext('request', {
    requestId: ctx.requestId,
    orgId: ctx.orgId,
    queueId: ctx.queueId,
    ticketId: ctx.ticketId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export function shouldCaptureException(status: number, code: string, exception: unknown): boolean {
  if (!isSentryEnabled()) return false;
  if (status >= 500) return true;

  if (isPrismaError(exception)) {
    return PRISMA_SYSTEM_FAILURE_CODES.has(exception.code);
  }

  if (code === 'DATABASE_SCHEMA_MISMATCH') return true;

  if (isJourneyCompleteErrorCode(code)) return true;

  return false;
}

export function captureServerException(
  exception: unknown,
  options: {
    status: number;
    code: string;
    requestId?: string;
    method?: string;
    url?: string;
    details?: Record<string, unknown>;
    context?: RequestContextData & { userId?: string; email?: string };
  },
): void {
  if (!shouldCaptureException(options.status, options.code, exception)) return;

  Sentry.withScope((scope) => {
    syncSentryRequestContext(options.context);
    scope.setTag('errorCode', options.code);
    scope.setTag('httpStatus', String(options.status));
    if (options.requestId) scope.setTag('requestId', options.requestId);

    scope.setContext('http', {
      method: options.method,
      url: options.url,
      status: options.status,
    });

    if (options.details) {
      scope.setContext('details', options.details);
    }

    if (isJourneyCompleteErrorCode(options.code)) {
      scope.setTag('feature', 'journey-complete');
      scope.setFingerprint(
        journeyCompleteErrorFingerprint(
          options.code,
          options.details as JourneyCompleteFailureDetails | undefined,
        ),
      );
    }

    Sentry.captureException(exception);
  });
}

function isPrismaError(
  err: unknown,
): err is { code: string; meta?: Record<string, unknown>; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string' &&
    String((err as Record<string, unknown>).code).startsWith('P')
  );
}

export function captureUnhandledProcessError(error: unknown, label: string): void {
  if (!isSentryEnabled()) return;
  Sentry.captureException(error instanceof Error ? error : new Error(`${label}: ${String(error)}`));
  void Sentry.flush(2000);
}
