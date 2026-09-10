import type { QueryClient } from '@tanstack/react-query';
import { tenantQueryKeys } from './tenant-query-keys';

export type TenantsListPayload = {
  items: Array<{
    id: string;
    status: string;
    visitJourneysEnabled?: boolean;
    appointmentsEnabled?: boolean;
    patronCrmEnabled?: boolean;
    subscriptions?: { plan: { slug: string; name: string } }[];
  }>;
  total: number;
  activeCount: number;
  suspendedCount: number;
  skip: number;
  take: number;
};

type TenantDetail = {
  id: string;
  status?: string;
  visitJourneysEnabled?: boolean;
  appointmentsEnabled?: boolean;
  subscriptions?: { status: string; plan: { name: string; slug: string } }[];
};

export function patchTenantStatusInCaches(
  queryClient: QueryClient,
  tenantId: string,
  suspend: boolean,
) {
  const nextStatus = suspend ? 'suspended' : 'active';

  queryClient.setQueryData<TenantDetail>(tenantQueryKeys.detail(tenantId), (old) =>
    old ? { ...old, status: nextStatus } : old,
  );

  queryClient.setQueriesData<TenantsListPayload>({ queryKey: tenantQueryKeys.all }, (old) => {
    if (!old?.items) return old;
    const wasSuspended = old.items.find((o) => o.id === tenantId)?.status === 'suspended';
    const nowSuspended = suspend;
    const activeDelta = wasSuspended === nowSuspended ? 0 : nowSuspended ? -1 : 1;
    const suspendedDelta = wasSuspended === nowSuspended ? 0 : nowSuspended ? 1 : -1;
    return {
      ...old,
      items: old.items.map((org) => (org.id === tenantId ? { ...org, status: nextStatus } : org)),
      activeCount: Math.max(0, old.activeCount + activeDelta),
      suspendedCount: Math.max(0, old.suspendedCount + suspendedDelta),
    };
  });
}

export function patchTenantPlanInCaches(
  queryClient: QueryClient,
  tenantId: string,
  planSlug: string,
  planName?: string,
) {
  queryClient.setQueryData<TenantDetail>(tenantQueryKeys.detail(tenantId), (old) => {
    if (!old) return old;
    const existing = old.subscriptions?.[0];
    return {
      ...old,
      subscriptions: [
        {
          status: existing?.status ?? 'active',
          plan: {
            slug: planSlug,
            name: planName ?? existing?.plan?.name ?? planSlug,
          },
        },
      ],
    };
  });

  queryClient.setQueriesData<TenantsListPayload>({ queryKey: tenantQueryKeys.all }, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((org) => {
        if (org.id !== tenantId) return org;
        const existing = org.subscriptions?.[0];
        return {
          ...org,
          subscriptions: [
            {
              ...existing,
              plan: {
                slug: planSlug,
                name: planName ?? existing?.plan?.name ?? planSlug,
              },
            },
          ],
        };
      }),
    };
  });
}

export function patchTenantVisitJourneysInCaches(
  queryClient: QueryClient,
  tenantId: string,
  visitJourneysEnabled: boolean,
) {
  queryClient.setQueryData<TenantDetail>(tenantQueryKeys.detail(tenantId), (old) =>
    old ? { ...old, visitJourneysEnabled } : old,
  );

  queryClient.setQueriesData<TenantsListPayload>({ queryKey: tenantQueryKeys.all }, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((o) => (o.id === tenantId ? { ...o, visitJourneysEnabled } : o)),
    };
  });
}

export function patchTenantAppointmentsInCaches(
  queryClient: QueryClient,
  tenantId: string,
  appointmentsEnabled: boolean,
) {
  queryClient.setQueryData<TenantDetail>(tenantQueryKeys.detail(tenantId), (old) =>
    old ? { ...old, appointmentsEnabled } : old,
  );

  queryClient.setQueriesData<TenantsListPayload>({ queryKey: tenantQueryKeys.all }, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((o) => (o.id === tenantId ? { ...o, appointmentsEnabled } : o)),
    };
  });
}

export function patchTenantPatronCrmInCaches(
  queryClient: QueryClient,
  tenantId: string,
  patronCrmEnabled: boolean,
) {
  queryClient.setQueryData<TenantDetail>(tenantQueryKeys.detail(tenantId), (old) =>
    old ? { ...old, patronCrmEnabled } : old,
  );

  queryClient.setQueriesData<TenantsListPayload>({ queryKey: tenantQueryKeys.all }, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((o) => (o.id === tenantId ? { ...o, patronCrmEnabled } : o)),
    };
  });
}
