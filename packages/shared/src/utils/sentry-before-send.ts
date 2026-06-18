import { scrubSensitiveRecord } from './sentry-pii';

type SentryEventLike = {
  request?: { headers?: Record<string, string | string[] | undefined> };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  user?: { email?: string; [key: string]: unknown };
};

/** Redact credentials and PII before events leave the process. */
export function applySentryPiiScrub<T extends SentryEventLike>(event: T): T {
  if (event.request?.headers) {
    const headers = { ...event.request.headers };
    for (const key of Object.keys(headers)) {
      if (/authorization|cookie|x-api-key/i.test(key)) {
        headers[key] = '[Redacted]';
      }
    }
    event.request.headers = headers;
  }

  if (event.user?.email) {
    const rest = { ...event.user };
    delete rest.email;
    event.user = rest;
  }

  if (event.extra) {
    event.extra = scrubSensitiveRecord(event.extra);
  }
  if (event.contexts) {
    event.contexts = scrubSensitiveRecord(event.contexts);
  }

  return event;
}
