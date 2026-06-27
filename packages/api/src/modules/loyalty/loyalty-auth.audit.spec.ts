import { describe, it, expect } from 'vitest';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  WEB_REFRESH_COOKIE,
  WEB_SESSION_COOKIE,
  resolveAccessTokenTtlSeconds,
} from '@queueplatform/shared';

/**
 * Auth audit — documents the loyalty app session contract (HttpOnly cookies + in-memory JWT).
 * Fails if shared auth constants change without updating the BFF / middleware.
 */
describe('Loyalty auth session contract', () => {
  it('uses stable cookie names for session and refresh tokens', () => {
    expect(WEB_SESSION_COOKIE).toBe('qp-session');
    expect(WEB_REFRESH_COOKIE).toBe('qp-refresh');
  });

  it('refresh token TTL exceeds access token TTL', () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBeGreaterThan(resolveAccessTokenTtlSeconds());
  });

  it('access token TTL is at least 5 minutes for proactive refresh lead time', () => {
    expect(resolveAccessTokenTtlSeconds()).toBeGreaterThanOrEqual(300);
  });
});
