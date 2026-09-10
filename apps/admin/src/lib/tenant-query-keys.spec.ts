import { describe, expect, it } from 'vitest';
import { tenantQueryKeys } from './tenant-query-keys';

describe('tenantQueryKeys', () => {
  it('roots list and detail keys under the same prefix for cache invalidation', () => {
    expect(tenantQueryKeys.all).toEqual(['ops', 'organizations']);
    expect(tenantQueryKeys.list(0, '').slice(0, 2)).toEqual(tenantQueryKeys.all);
  });

  it('encodes pagination and search into the list key so distinct queries do not collide', () => {
    expect(tenantQueryKeys.list(0, '')).toEqual(['ops', 'organizations', 0, '']);
    expect(tenantQueryKeys.list(20, 'acme')).toEqual(['ops', 'organizations', 20, 'acme']);
    expect(tenantQueryKeys.list(20, 'acme')).not.toEqual(tenantQueryKeys.list(0, 'acme'));
    expect(tenantQueryKeys.list(0, 'acme')).not.toEqual(tenantQueryKeys.list(0, 'beta'));
  });

  it('scopes detail keys by tenant id', () => {
    expect(tenantQueryKeys.detail('t1')).toEqual(['ops', 'tenant', 't1']);
    expect(tenantQueryKeys.detail('t1')).not.toEqual(tenantQueryKeys.detail('t2'));
  });

  it('exposes a stable deployment-features key', () => {
    expect(tenantQueryKeys.deploymentFeatures).toEqual(['ops', 'deployment', 'features']);
  });
});
