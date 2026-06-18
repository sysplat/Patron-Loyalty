import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getObservabilityRelease } from './observability-release';

const RELEASE_ENV_KEYS = [
  'SENTRY_RELEASE',
  'NEXT_PUBLIC_SENTRY_RELEASE',
  'RAILWAY_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_SHA',
] as const;

describe('getObservabilityRelease', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of RELEASE_ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of RELEASE_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('falls back to "development" when no release env var is set', () => {
    expect(getObservabilityRelease()).toBe('development');
  });

  it('prefers SENTRY_RELEASE above all other sources', () => {
    process.env.SENTRY_RELEASE = 'sentry-rel';
    process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-sha';
    expect(getObservabilityRelease()).toBe('sentry-rel');
  });

  it('uses platform commit SHAs when explicit release is absent', () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-sha';
    expect(getObservabilityRelease()).toBe('railway-sha');

    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-sha';
    expect(getObservabilityRelease()).toBe('vercel-sha');
  });

  it('ignores whitespace-only values', () => {
    process.env.SENTRY_RELEASE = '   ';
    process.env.NEXT_PUBLIC_SENTRY_RELEASE = 'public-rel';
    expect(getObservabilityRelease()).toBe('public-rel');
  });
});
