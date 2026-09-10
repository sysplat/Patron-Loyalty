import { afterEach, describe, expect, it } from 'vitest';
import {
  installStructuredServerLogs,
  resetStructuredServerLogsForTests,
  shouldUseStructuredServerLogs,
} from './structured-server-log';

describe('shouldUseStructuredServerLogs', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFormat = process.env.LOG_FORMAT;

  afterEach(() => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevFormat === undefined) delete process.env.LOG_FORMAT;
    else process.env.LOG_FORMAT = prevFormat;
  });

  it('defaults on in production', () => {
    expect(shouldUseStructuredServerLogs({ NODE_ENV: 'production' })).toBe(true);
  });

  it('respects LOG_FORMAT=pretty', () => {
    expect(shouldUseStructuredServerLogs({ NODE_ENV: 'production', LOG_FORMAT: 'pretty' })).toBe(
      false,
    );
  });
});

describe('installStructuredServerLogs', () => {
  it('emits JSON for Error and string messages', () => {
    process.env.LOG_FORMAT = 'json';
    process.env.NODE_ENV = 'test'; // shouldUse is false in test…
    // Force install path by temporarily faking production via direct call after patching check:
    // Call with LOG_FORMAT=json and NODE_ENV not test — flip NODE_ENV for this test only.
    process.env.NODE_ENV = 'production';

    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    const originalLog = console.log;
    const originalError = console.error;

    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      resetStructuredServerLogsForTests();
      installStructuredServerLogs('web');
      console.log('hello');
      console.error(new Error('boom'));
    } finally {
      process.stdout.write = originalWrite;
      console.log = originalLog;
      console.error = originalError;
      resetStructuredServerLogsForTests();
      process.env.NODE_ENV = 'test';
      delete process.env.LOG_FORMAT;
    }

    expect(writes.length).toBeGreaterThanOrEqual(2);
    const info = JSON.parse(writes[0]!.trim()) as Record<string, unknown>;
    expect(info.service).toBe('web');
    expect(info.level).toBe('info');
    expect(info.message).toBe('hello');

    const err = JSON.parse(writes[1]!.trim()) as Record<string, unknown>;
    expect(err.level).toBe('error');
    expect(err.message).toBe('boom');
  });
});
