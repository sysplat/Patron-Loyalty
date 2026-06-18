import { describe, it, expect } from 'vitest';
import {
  DISPLAY_API_KEY_COOKIE,
  DISPLAY_CREDENTIAL_TTL_SECONDS,
  DISPLAY_DEVICE_COOKIE,
  DISPLAY_SESSION_COOKIE,
  DISPLAY_SESSION_TTL_SECONDS,
} from './frontend';

describe('display session cookie constants', () => {
  it('defines separate long-lived credential and short-lived session cookies', () => {
    expect(DISPLAY_DEVICE_COOKIE).toBe('qp-display-device');
    expect(DISPLAY_API_KEY_COOKIE).toBe('qp-display-api-key');
    expect(DISPLAY_SESSION_COOKIE).toBe('qp-display-session');
  });

  it('uses long credential TTL and shorter session JWT cookie TTL', () => {
    expect(DISPLAY_CREDENTIAL_TTL_SECONDS).toBeGreaterThan(DISPLAY_SESSION_TTL_SECONDS);
    expect(DISPLAY_CREDENTIAL_TTL_SECONDS).toBe(60 * 60 * 24 * 365);
    expect(DISPLAY_SESSION_TTL_SECONDS).toBe(60 * 60 * 24);
  });
});
