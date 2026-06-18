import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isSentryEnabled, shouldCaptureException } from './sentry';

describe('isSentryEnabled', () => {
  let savedDsn: string | undefined;
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedDsn = process.env.SENTRY_DSN;
    savedEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (savedDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = savedDsn;
    if (savedEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedEnv;
  });

  it('is disabled when no DSN is configured', () => {
    delete process.env.SENTRY_DSN;
    process.env.NODE_ENV = 'production';
    expect(isSentryEnabled()).toBe(false);
  });

  it('stays disabled under NODE_ENV=test even with a DSN (keeps CI/test noise-free)', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.NODE_ENV = 'test';
    expect(isSentryEnabled()).toBe(false);
  });

  it('is enabled the moment a DSN is set outside the test environment', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.NODE_ENV = 'production';
    expect(isSentryEnabled()).toBe(true);
  });
});

describe('shouldCaptureException', () => {
  let savedDsn: string | undefined;
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedDsn = process.env.SENTRY_DSN;
    savedEnv = process.env.NODE_ENV;
    // Force the "enabled" path so capture-policy branches are exercised.
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    if (savedDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = savedDsn;
    if (savedEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedEnv;
  });

  it('never captures when Sentry is disabled, regardless of severity', () => {
    delete process.env.SENTRY_DSN;
    expect(shouldCaptureException(500, 'INTERNAL_ERROR', new Error('boom'))).toBe(false);
  });

  it('captures all 5xx server errors', () => {
    expect(shouldCaptureException(500, 'INTERNAL_ERROR', new Error('boom'))).toBe(true);
    expect(shouldCaptureException(503, 'SERVICE_UNAVAILABLE', new Error('down'))).toBe(true);
  });

  it('does not capture ordinary 4xx client errors', () => {
    expect(shouldCaptureException(400, 'VALIDATION_ERROR', new Error('bad input'))).toBe(false);
    expect(shouldCaptureException(404, 'NOT_FOUND', new Error('missing'))).toBe(false);
  });

  it('captures schema-mismatch Prisma faults even at non-5xx status', () => {
    expect(
      shouldCaptureException(400, 'SOME_CODE', { code: 'P2022', message: 'column missing' }),
    ).toBe(true);
    expect(shouldCaptureException(400, 'DATABASE_SCHEMA_MISMATCH', new Error('skew'))).toBe(true);
  });

  it('captures structured journey complete failures at 4xx', () => {
    expect(
      shouldCaptureException(400, 'JOURNEY_ISSUE_NEXT_FAILED', new Error('issue failed')),
    ).toBe(true);
  });

  it('ignores benign Prisma errors that are not system-level faults', () => {
    expect(shouldCaptureException(404, 'NOT_FOUND', { code: 'P2025', message: 'no record' })).toBe(
      false,
    );
  });
});
