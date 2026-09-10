import * as Sentry from '@sentry/nextjs';
import type { AuthUser } from '@/lib/auth-store';

export function isSentryClientEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function syncSentryAuthContext(user: AuthUser | null): void {
  if (!isSentryClientEnabled()) return;

  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
    Sentry.setTag('orgId', user.orgId);
    if (user.impersonation) {
      Sentry.setTag('impersonation', 'true');
    }
    if (user.platformOperator) {
      Sentry.setTag('platformOperator', 'true');
    }
  } else {
    Sentry.setUser(null);
  }
}

export function captureApiError(
  error: Error,
  context: {
    path: string;
    method: string;
    status: number;
    code?: string;
    requestId?: string;
    details?: Record<string, unknown>;
  },
): void {
  if (!isSentryClientEnabled() || context.status < 500) return;

  Sentry.withScope((scope) => {
    scope.setTag('apiPath', context.path);
    scope.setTag('httpStatus', String(context.status));
    if (context.code) scope.setTag('errorCode', context.code);
    if (context.requestId) scope.setTag('requestId', context.requestId);
    scope.setContext('api', {
      path: context.path,
      method: context.method,
      status: context.status,
      details: context.details,
    });
    Sentry.captureException(error);
  });
}
