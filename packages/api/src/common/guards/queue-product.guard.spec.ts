import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_DEPLOY_PROFILES } from '@queueplatform/shared';
import { QueueProductGuard } from './queue-product.guard';

describe('QueueProductGuard', () => {
  const queueProduct = { requireEnabled: vi.fn() };
  let guard: QueueProductGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new QueueProductGuard(new Reflector(), queueProduct as never);
  });

  it('allows non-queue API paths on full deploy', async () => {
    vi.stubEnv('API_DEPLOY_PROFILE', API_DEPLOY_PROFILES.FULL);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/v1/loyalty/patrons',
          user: { orgId: 'org-1' },
        }),
      }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(queueProduct.requireEnabled).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('requires queue product for QMS paths when org is authenticated', async () => {
    vi.stubEnv('API_DEPLOY_PROFILE', API_DEPLOY_PROFILES.FULL);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/v1/tickets',
          user: { orgId: 'org-loyalty-only' },
        }),
      }),
    };

    queueProduct.requireEnabled.mockResolvedValue(undefined);
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(queueProduct.requireEnabled).toHaveBeenCalledWith('org-loyalty-only');
    vi.unstubAllEnvs();
  });

  it('skips queue checks on loyalty-only deploy profile', async () => {
    vi.stubEnv('API_DEPLOY_PROFILE', API_DEPLOY_PROFILES.LOYALTY);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/v1/tickets',
          user: { orgId: 'org-1' },
        }),
      }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(queueProduct.requireEnabled).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('propagates NotFound when queue product is not licensed', async () => {
    vi.stubEnv('API_DEPLOY_PROFILE', API_DEPLOY_PROFILES.FULL);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          path: '/api/v1/queues',
          user: { orgId: 'org-1' },
        }),
      }),
    };

    queueProduct.requireEnabled.mockRejectedValue(new NotFoundException());
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(NotFoundException);
    vi.unstubAllEnvs();
  });
});
