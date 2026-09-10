import * as Sentry from '@sentry/nextjs';
import { installStructuredServerLogs } from '@queueplatform/shared';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    installStructuredServerLogs('admin');
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
