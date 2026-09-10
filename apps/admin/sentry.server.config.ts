import * as Sentry from '@sentry/nextjs';
import { applySentryPiiScrub, getObservabilityRelease } from '@queueplatform/shared';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProd = process.env.NODE_ENV === 'production';

if (dsn) {
  Sentry.init({
    dsn,
    release: getObservabilityRelease(),
    tracesSampleRate: isProd ? 0.1 : 1.0,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    debug: false,
    beforeSend(event) {
      return applySentryPiiScrub(event);
    },
  });
}
