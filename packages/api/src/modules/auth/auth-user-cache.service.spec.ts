import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthUserCacheService,
  authUserCacheKey,
  type CachedAuthUser,
} from './auth-user-cache.service';

const mockRedis = {
  getJson: vi.fn(),
  setJson: vi.fn(),
  del: vi.fn(),
};

const sampleUser: CachedAuthUser = {
  id: 'user-1',
  orgId: 'org-1',
  email: 'a@example.com',
  status: 'active',
  organization: { status: 'active', slug: 'acme' },
};

describe('AuthUserCacheService', () => {
  const originalEnv = process.env.AUTH_USER_CACHE_TTL_SECONDS;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AUTH_USER_CACHE_TTL_SECONDS;
    else process.env.AUTH_USER_CACHE_TTL_SECONDS = originalEnv;
  });

  it('builds a namespaced cache key', () => {
    expect(authUserCacheKey('user-1')).toBe('auth:user:user-1');
  });

  it('reads and writes through Redis when enabled (default TTL)', async () => {
    delete process.env.AUTH_USER_CACHE_TTL_SECONDS;
    const service = new AuthUserCacheService(mockRedis as never);
    expect(service.enabled).toBe(true);

    mockRedis.getJson.mockResolvedValue(sampleUser);
    await expect(service.get('user-1')).resolves.toEqual(sampleUser);
    expect(mockRedis.getJson).toHaveBeenCalledWith('auth:user:user-1');

    await service.set(sampleUser);
    expect(mockRedis.setJson).toHaveBeenCalledWith('auth:user:user-1', sampleUser, 20);
  });

  it('honors a custom TTL from env', async () => {
    process.env.AUTH_USER_CACHE_TTL_SECONDS = '5';
    const service = new AuthUserCacheService(mockRedis as never);

    await service.set(sampleUser);
    expect(mockRedis.setJson).toHaveBeenCalledWith('auth:user:user-1', sampleUser, 5);
  });

  it('disables caching when TTL is 0 (no reads or writes)', async () => {
    process.env.AUTH_USER_CACHE_TTL_SECONDS = '0';
    const service = new AuthUserCacheService(mockRedis as never);
    expect(service.enabled).toBe(false);

    await expect(service.get('user-1')).resolves.toBeNull();
    await service.set(sampleUser);

    expect(mockRedis.getJson).not.toHaveBeenCalled();
    expect(mockRedis.setJson).not.toHaveBeenCalled();
  });

  it('always deletes on invalidate, even when caching is disabled', async () => {
    process.env.AUTH_USER_CACHE_TTL_SECONDS = '0';
    const service = new AuthUserCacheService(mockRedis as never);

    await service.invalidate('user-1');
    expect(mockRedis.del).toHaveBeenCalledWith('auth:user:user-1');
  });

  it('swallows Redis read errors and returns null', async () => {
    delete process.env.AUTH_USER_CACHE_TTL_SECONDS;
    const service = new AuthUserCacheService(mockRedis as never);
    mockRedis.getJson.mockRejectedValue(new Error('boom'));

    await expect(service.get('user-1')).resolves.toBeNull();
  });
});
