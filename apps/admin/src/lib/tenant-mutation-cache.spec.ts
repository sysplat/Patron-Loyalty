import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { tenantQueryKeys } from './tenant-query-keys';
import {
  patchTenantPlanInCaches,
  patchTenantStatusInCaches,
  patchTenantVisitJourneysInCaches,
  type TenantsListPayload,
} from './tenant-mutation-cache';

function makeList(
  overrides?: Partial<TenantsListPayload>,
  items?: TenantsListPayload['items'],
): TenantsListPayload {
  return {
    items: items ?? [
      { id: 't1', status: 'active', subscriptions: [{ plan: { slug: 'free', name: 'Free' } }] },
      { id: 't2', status: 'suspended', subscriptions: [{ plan: { slug: 'pro', name: 'Pro' } }] },
    ],
    total: 2,
    activeCount: 1,
    suspendedCount: 1,
    skip: 0,
    take: 20,
    ...overrides,
  };
}

describe('patchTenantStatusInCaches', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
  });

  it('flips the detail cache status optimistically', () => {
    qc.setQueryData(tenantQueryKeys.detail('t1'), { id: 't1', status: 'active' });
    patchTenantStatusInCaches(qc, 't1', true);
    expect(qc.getQueryData(tenantQueryKeys.detail('t1'))).toMatchObject({ status: 'suspended' });

    patchTenantStatusInCaches(qc, 't1', false);
    expect(qc.getQueryData(tenantQueryKeys.detail('t1'))).toMatchObject({ status: 'active' });
  });

  it('suspending an active tenant decrements active and increments suspended counts', () => {
    qc.setQueryData(tenantQueryKeys.list(0, ''), makeList());
    patchTenantStatusInCaches(qc, 't1', true);

    const list = qc.getQueryData<TenantsListPayload>(tenantQueryKeys.list(0, ''));
    expect(list?.items.find((o) => o.id === 't1')?.status).toBe('suspended');
    expect(list?.activeCount).toBe(0);
    expect(list?.suspendedCount).toBe(2);
  });

  it('reactivating a suspended tenant moves the counts the other way', () => {
    qc.setQueryData(tenantQueryKeys.list(0, ''), makeList());
    patchTenantStatusInCaches(qc, 't2', false);

    const list = qc.getQueryData<TenantsListPayload>(tenantQueryKeys.list(0, ''));
    expect(list?.items.find((o) => o.id === 't2')?.status).toBe('active');
    expect(list?.activeCount).toBe(2);
    expect(list?.suspendedCount).toBe(0);
  });

  it('is a no-op for counts when the status does not actually change', () => {
    qc.setQueryData(tenantQueryKeys.list(0, ''), makeList());
    patchTenantStatusInCaches(qc, 't2', true); // t2 already suspended

    const list = qc.getQueryData<TenantsListPayload>(tenantQueryKeys.list(0, ''));
    expect(list?.activeCount).toBe(1);
    expect(list?.suspendedCount).toBe(1);
  });

  it('never drives counts negative', () => {
    qc.setQueryData(
      tenantQueryKeys.list(0, ''),
      makeList({ activeCount: 0, suspendedCount: 0 }, [{ id: 't1', status: 'active' }]),
    );
    patchTenantStatusInCaches(qc, 't1', true);

    const list = qc.getQueryData<TenantsListPayload>(tenantQueryKeys.list(0, ''));
    expect(list?.activeCount).toBeGreaterThanOrEqual(0);
    expect(list?.suspendedCount).toBeGreaterThanOrEqual(0);
  });

  it('updates every list query that holds the tenant (paginated/searched caches)', () => {
    qc.setQueryData(tenantQueryKeys.list(0, ''), makeList());
    qc.setQueryData(tenantQueryKeys.list(0, 'acme'), makeList());
    patchTenantStatusInCaches(qc, 't1', true);

    for (const key of [tenantQueryKeys.list(0, ''), tenantQueryKeys.list(0, 'acme')]) {
      const list = qc.getQueryData<TenantsListPayload>(key);
      expect(list?.items.find((o) => o.id === 't1')?.status).toBe('suspended');
    }
  });
});

describe('patchTenantPlanInCaches', () => {
  it('rewrites the primary subscription plan slug in detail and list caches', () => {
    const qc = new QueryClient();
    qc.setQueryData(tenantQueryKeys.detail('t1'), {
      id: 't1',
      subscriptions: [{ status: 'active', plan: { slug: 'free', name: 'Free' } }],
    });
    qc.setQueryData(tenantQueryKeys.list(0, ''), makeList());

    patchTenantPlanInCaches(qc, 't1', 'pro');

    expect(qc.getQueryData(tenantQueryKeys.detail('t1'))).toMatchObject({
      subscriptions: [{ plan: { slug: 'pro' } }],
    });
    const list = qc.getQueryData<TenantsListPayload>(tenantQueryKeys.list(0, ''));
    expect(list?.items.find((o) => o.id === 't1')?.subscriptions?.[0]?.plan?.slug).toBe('pro');
  });

  it('preserves the existing plan display name when only the slug changes', () => {
    const qc = new QueryClient();
    qc.setQueryData(tenantQueryKeys.list(0, ''), makeList());
    patchTenantPlanInCaches(qc, 't2', 'enterprise');

    const list = qc.getQueryData<TenantsListPayload>(tenantQueryKeys.list(0, ''));
    expect(list?.items.find((o) => o.id === 't2')?.subscriptions?.[0]?.plan).toEqual({
      slug: 'enterprise',
      name: 'Pro',
    });
  });

  it('creates a subscription entry when the tenant was in setup mode', () => {
    const qc = new QueryClient();
    qc.setQueryData(tenantQueryKeys.detail('t1'), { id: 't1', subscriptions: [] });
    patchTenantPlanInCaches(qc, 't1', 'starter', 'Starter');
    expect(qc.getQueryData(tenantQueryKeys.detail('t1'))).toMatchObject({
      subscriptions: [{ status: 'active', plan: { slug: 'starter', name: 'Starter' } }],
    });
  });
});

describe('patchTenantVisitJourneysInCaches', () => {
  it('toggles the visit-journeys flag in both detail and list caches', () => {
    const qc = new QueryClient();
    qc.setQueryData(tenantQueryKeys.detail('t1'), { id: 't1', visitJourneysEnabled: false });
    qc.setQueryData(tenantQueryKeys.list(0, ''), makeList());

    patchTenantVisitJourneysInCaches(qc, 't1', true);

    expect(qc.getQueryData(tenantQueryKeys.detail('t1'))).toMatchObject({
      visitJourneysEnabled: true,
    });
    const list = qc.getQueryData<TenantsListPayload>(tenantQueryKeys.list(0, ''));
    expect(list?.items.find((o) => o.id === 't1')?.visitJourneysEnabled).toBe(true);
  });

  it('leaves caches untouched when there is no data yet', () => {
    const qc = new QueryClient();
    expect(() => patchTenantVisitJourneysInCaches(qc, 't1', true)).not.toThrow();
    expect(qc.getQueryData(tenantQueryKeys.detail('t1'))).toBeUndefined();
  });
});
