import * as Sentry from '@sentry/nextjs';
import { applySentryPiiScrub, getObservabilityRelease } from '@queueplatform/shared';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProd = process.env.NODE_ENV === 'production';

if (dsn) {
  Sentry.init({
    dsn,
    release: getObservabilityRelease(),
    integrations: [Sentry.replayIntegration()],
    tracesSampleRate: isProd ? 0.1 : 1.0,
    replaysSessionSampleRate: isProd ? 0.05 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    debug: false,
    beforeSend(event) {
      return applySentryPiiScrub(event);
    },
  });
}
