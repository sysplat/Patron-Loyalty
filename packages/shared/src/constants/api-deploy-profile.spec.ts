import { describe, it, expect, vi, afterEach } from 'vitest';
import { API_DEPLOY_PROFILES, resolveApiDeployProfile } from './api-deploy-profile';
import { isQueueProductApiPath } from './queue-product-api';

describe('resolveApiDeployProfile', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to full when unset', () => {
    vi.stubEnv('API_DEPLOY_PROFILE', '');
    expect(resolveApiDeployProfile()).toBe(API_DEPLOY_PROFILES.FULL);
  });

  it('returns loyalty for loyalty profile', () => {
    vi.stubEnv('API_DEPLOY_PROFILE', 'loyalty');
    expect(resolveApiDeployProfile()).toBe(API_DEPLOY_PROFILES.LOYALTY);
  });
});

describe('isQueueProductApiPath', () => {
  it('matches QMS route prefixes', () => {
    expect(isQueueProductApiPath('/api/v1/tickets/abc')).toBe(true);
    expect(isQueueProductApiPath('/api/v1/queues')).toBe(true);
    expect(isQueueProductApiPath('/api/v1/loyalty/patrons')).toBe(false);
  });
});
