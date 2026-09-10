'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Layers,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@queueplatform/frontend-core';
import { ImpersonationDialog } from '@/components/impersonation-dialog';
import { actionButtonStyles } from '@/lib/action-button-styles';
import { cn } from '@/lib/utils';
import {
  BulkStatusResult,
  BillingPlanOption,
  formatBulkResultToast,
  formatTenantPlanSlug,
  isSelectableTenant,
  SETUP_MODE_PLAN_LABEL,
} from '@/components/tenants/tenant-page-helpers';
import { tenantQueryKeys } from '@/lib/tenant-query-keys';
import { patchTenantPlanInCaches } from '@/lib/tenant-mutation-cache';

type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subscriptions: { plan: { slug: string; name: string } }[];
};

type DeploymentFeatures = {
  visitJourneysGloballyDisabled: boolean;
  visitJourneysLegacyGlobalOn: boolean;
};

type TenantsListPayload = {
  items: Organization[];
  total: number;
  activeCount: number;
  suspendedCount: number;
  skip: number;
  take: number;
};

export default function TenantsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const [impersonationTarget, setImpersonationTarget] = useState<{
    orgId: string;
    orgName: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  } | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirm, setBulkConfirm] = useState<{ suspend: boolean; ids: string[] } | null>(null);
  const take = 30;
  const skip = (page - 1) * take;
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const orgListKey = tenantQueryKeys.list(skip, debouncedSearch);

  const { data: deploymentFeatures } = useQuery({
    queryKey: tenantQueryKeys.deploymentFeatures,
    queryFn: () =>
      api
        .get<{ data: DeploymentFeatures }>('/platform-admin/deployment/features', { token: token! })
        .then((r) => r?.data),
    enabled: !!token,
    staleTime: 60_000,
    retry: false,
  });

  const {
    data: tenantsPayload,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: orgListKey,
    queryFn: () =>
      api
        .get<{
          data: TenantsListPayload;
        }>(
          `/platform-admin/tenants?skip=${skip}&take=${take}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
          { token: token! },
        )
        .then((r) => r?.data),
    enabled: !!token,
    retry: false,
  });

  const { data: billingPlans = [] } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () =>
      api
        .get<{ data: BillingPlanOption[] }>('/billing/plans', { token: token! })
        .then((r) => r?.data ?? []),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const orgs = useMemo(() => tenantsPayload?.items ?? [], [tenantsPayload?.items]);

  const selectableOrgs = useMemo(() => orgs.filter(isSelectableTenant), [orgs]);
  const selectableIds = useMemo(() => selectableOrgs.map((o) => o.id), [selectableOrgs]);
  const allPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const selectedOrgs = useMemo(
    () => orgs.filter((o) => selectedIds.includes(o.id)),
    [orgs, selectedIds],
  );
  const selectedActiveCount = selectedOrgs.filter((o) => o.status !== 'suspended').length;
  const selectedSuspendedCount = selectedOrgs.filter((o) => o.status === 'suspended').length;

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => selectableIds.includes(id)));
  }, [selectableIds]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !selectableIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...selectableIds])]);
    }
  };

  const bulkStatusMutation = useMutation({
    mutationFn: ({ organizationIds, suspend }: { organizationIds: string[]; suspend: boolean }) =>
      api
        .post<{
          data: BulkStatusResult;
        }>('/platform-admin/tenants/bulk-status', { organizationIds, suspend }, { token: token! })
        .then((r) => r?.data),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: orgListKey });
      const previousOrgs = queryClient.getQueryData(orgListKey);
      queryClient.setQueryData(orgListKey, (old: TenantsListPayload | undefined) => {
        if (!old) return old;

        let activeDelta = 0;
        let suspendedDelta = 0;

        const updatedItems = old.items.map((org) => {
          if (vars.organizationIds.includes(org.id)) {
            const wasSuspended = org.status === 'suspended';
            const nowSuspended = vars.suspend;
            if (wasSuspended !== nowSuspended) {
              if (nowSuspended) {
                activeDelta--;
                suspendedDelta++;
              } else {
                activeDelta++;
                suspendedDelta--;
              }
            }
            return { ...org, status: nowSuspended ? 'suspended' : 'active' };
          }
          return org;
        });

        return {
          ...old,
          items: updatedItems,
          activeCount: Math.max(0, old.activeCount + activeDelta),
          suspendedCount: Math.max(0, old.suspendedCount + suspendedDelta),
        };
      });
      setBulkConfirm(null);
      return { previousOrgs };
    },
    onSuccess: (result, variables) => {
      if (!result) return;
      formatBulkResultToast(result, variables.suspend);
      setSelectedIds((prev) => prev.filter((id) => !result.succeeded.some((s) => s.id === id)));
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(orgListKey, context?.previousOrgs);
      toast.error('Bulk status update failed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orgListKey });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      api.patch(`/platform-admin/tenants/${id}/suspend`, { suspend }, { token: token! }),
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: orgListKey });
      const previousOrgs = queryClient.getQueryData(orgListKey);
      queryClient.setQueryData(orgListKey, (old: TenantsListPayload | undefined) => {
        if (!old) return old;
        const wasSuspended = old.items.find((o) => o.id === newStatus.id)?.status === 'suspended';
        const nowSuspended = newStatus.suspend;
        const activeDelta = wasSuspended === nowSuspended ? 0 : nowSuspended ? -1 : 1;
        const suspendedDelta = wasSuspended === nowSuspended ? 0 : nowSuspended ? 1 : -1;
        return {
          ...old,
          items: old.items.map((org) =>
            org.id === newStatus.id
              ? { ...org, status: nowSuspended ? 'suspended' : 'active' }
              : org,
          ),
          activeCount: Math.max(0, old.activeCount + activeDelta),
          suspendedCount: Math.max(0, old.suspendedCount + suspendedDelta),
        };
      });
      return { previousOrgs };
    },
    onError: (_err, _newStatus, context) => {
      queryClient.setQueryData(orgListKey, context?.previousOrgs);
      toast.error('Failed to update tenant status');
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.suspend ? 'Organization suspended' : 'Organization restored');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orgListKey });
    },
  });

  const platformVisitLocked = deploymentFeatures?.visitJourneysGloballyDisabled === true;
  const platformVisitLegacyGlobal = deploymentFeatures?.visitJourneysLegacyGlobalOn === true;

  const planMutation = useMutation({
    mutationFn: ({ id, planSlug }: { id: string; planSlug: string }) =>
      api.patch(`/platform-admin/tenants/${id}/plan`, { planSlug }, { token: token! }),
    onMutate: async (newPlan) => {
      await queryClient.cancelQueries({ queryKey: orgListKey });
      const previousOrgs = queryClient.getQueryData(orgListKey);
      const planName = billingPlans.find((p) => p.slug === newPlan.planSlug)?.name;
      patchTenantPlanInCaches(queryClient, newPlan.id, newPlan.planSlug, planName);
      return { previousOrgs };
    },
    onError: (_err, _newPlan, context) => {
      queryClient.setQueryData(orgListKey, context?.previousOrgs);
      toast.error('Failed to update subscription plan');
    },
    onSuccess: () => {
      toast.success('Plan updated successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orgListKey });
    },
  });

  const handleImpersonate = (orgId: string, orgName: string) => {
    setImpersonationTarget({ orgId, orgName });
  };

  const stats = {
    total: tenantsPayload?.total ?? 0,
    active: tenantsPayload?.activeCount ?? 0,
    suspended: tenantsPayload?.suspendedCount ?? 0,
  };

  const bulkConfirmNames = bulkConfirm
    ? orgs
        .filter((o) => bulkConfirm.ids.includes(o.id))
        .map((o) => o.name)
        .slice(0, 5)
    : [];
  const bulkConfirmExtra =
    bulkConfirm && bulkConfirm.ids.length > bulkConfirmNames.length
      ? bulkConfirm.ids.length - bulkConfirmNames.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor tenants here; open a row to manage multi-step visits, appointments, and Patron
            CRM under Settings.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by name, slug, email or ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset to first page on search
            }}
            className="block w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm placeholder-slate-400 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {platformVisitLocked && (
        <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold">Visit journeys are off for every tenant</p>
            <p className="mt-1 text-rose-800/90">
              This deployment has{' '}
              <code className="rounded bg-white/70 px-1 py-0.5 text-xs">
                FEATURE_VISIT_JOURNEYS=false
              </code>
              . Public join will issue single tickets only until ops changes the API environment.
            </p>
          </div>
        </div>
      )}

      {platformVisitLegacyGlobal && !platformVisitLocked && (
        <div className="flex gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950 shadow-sm">
          <Info className="h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="font-semibold">Visit journeys forced on platform-wide</p>
            <p className="mt-1 text-indigo-900/85">
              <code className="rounded bg-white/70 px-1 py-0.5 text-xs">
                FEATURE_VISIT_JOURNEYS=true
              </code>{' '}
              — every tenant gets multi-step-capable issuance; per-tenant toggles are locked.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { label: 'Total Organizations', value: stats.total, color: 'text-slate-600 bg-slate-50' },
          { label: 'Active Tenants', value: stats.active, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Suspended', value: stats.suspended, color: 'text-red-600 bg-red-50' },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {s.label}
            </span>
            <p className={`mt-1 text-2xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="w-12 px-4 py-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={allPageSelected}
                    disabled={selectableIds.length === 0 || isLoading}
                    onChange={toggleSelectAllPage}
                    aria-label="Select all organizations on this page"
                  />
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Organization
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Slug
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Current Plan
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                      <div className="h-4 w-1/4 rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3">
                      <div className="flex h-12 w-12 animate-bounce items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600 shadow-sm">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Failed to Load Organizations
                        </h3>
                        <p className="text-xs leading-relaxed text-slate-500">
                          {error instanceof Error
                            ? error.message
                            : 'An error occurred while fetching tenant data from the API.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => queryClient.invalidateQueries({ queryKey: orgListKey })}
                        className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-indigo-600/10 transition-all hover:bg-indigo-700 active:scale-95"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2.5 text-slate-500">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400">
                        <Info className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-slate-800">No tenants found</h4>
                        <p className="mt-0.5 text-[11px] leading-normal">
                          There are no organization tenants registered or matching the query.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                orgs.map((org) => {
                  const currentPlan = formatTenantPlanSlug(org.subscriptions?.[0]);
                  const isSuspended = org.status === 'suspended';
                  const selectable = isSelectableTenant(org);
                  const isSelected = selectedIds.includes(org.id);
                  const rowPlanOptions =
                    currentPlan && !billingPlans.some((p) => p.slug === currentPlan)
                      ? [
                          ...billingPlans,
                          {
                            slug: currentPlan,
                            name: org.subscriptions?.[0]?.plan?.name || currentPlan,
                          },
                        ]
                      : billingPlans;
                  return (
                    <tr
                      key={org.id}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          target.closest('button') ||
                          target.closest('select') ||
                          target.closest('input') ||
                          target.closest('a')
                        ) {
                          return;
                        }
                        router.push(`/tenants/${org.id}`);
                      }}
                      className={cn(
                        'group cursor-pointer transition-colors hover:bg-slate-50/50',
                        isSelected && 'bg-indigo-50/40 dark:bg-indigo-950/20',
                      )}
                    >
                      <td className="px-4 py-5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                          checked={isSelected}
                          disabled={!selectable}
                          onChange={() => toggleSelect(org.id)}
                          aria-label={`Select ${org.name}`}
                          title={
                            selectable
                              ? undefined
                              : 'Internal platform organization cannot be bulk-selected'
                          }
                        />
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 font-bold text-slate-400 transition-colors group-hover:bg-white">
                            {org.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex flex-col">
                            <Link
                              href={`/tenants/${org.id}`}
                              className="font-semibold text-slate-900 transition-colors hover:underline group-hover:text-indigo-600"
                            >
                              {org.name}
                            </Link>
                            <span className="font-mono text-[10px] text-slate-400">
                              #{org.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-mono text-sm text-slate-500">{org.slug}</td>
                      <td className="px-6 py-5">
                        <select
                          value={currentPlan}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            planMutation.mutate({ id: org.id, planSlug: e.target.value });
                          }}
                          className="rounded-lg border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          disabled={planMutation.isPending || rowPlanOptions.length === 0}
                        >
                          {!currentPlan && (
                            <option value="" disabled>
                              {SETUP_MODE_PLAN_LABEL}
                            </option>
                          )}
                          {rowPlanOptions.map((plan) => (
                            <option key={plan.slug} value={plan.slug}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            isSuspended
                              ? 'border-red-100 bg-red-50 text-red-700'
                              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <span
                            className={`h-1 w-1 rounded-full ${isSuspended ? 'bg-red-500' : 'bg-emerald-500'}`}
                          />
                          {org.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() =>
                              setConfirmAction({
                                title: isSuspended
                                  ? 'Restore Organization'
                                  : 'Suspend Organization',
                                description: isSuspended
                                  ? `Are you sure you want to restore "${org.name}"? This will re-enable all branch and customer portals for this tenant.`
                                  : `Are you sure you want to suspend "${org.name}"? This will immediately disable all portals and dashboards for this tenant and all their users.`,
                                variant: isSuspended ? 'default' : 'destructive',
                                onConfirm: () =>
                                  suspendMutation.mutate({ id: org.id, suspend: !isSuspended }),
                              })
                            }
                            className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                              isSuspended
                                ? 'border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'border-red-100 bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                            disabled={suspendMutation.isPending}
                          >
                            {isSuspended ? 'Restore' : 'Suspend'}
                          </button>
                          <button
                            onClick={() => handleImpersonate(org.id, org.name)}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
                          >
                            <Users className="h-3 w-3" />
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-slate-500">
          Showing <span className="font-medium">{orgs.length}</span> of{' '}
          <span className="font-medium">{stats.total}</span> organizations
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-medium text-slate-700">
            Page {page} of {Math.ceil(stats.total / take) || 1}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(stats.total / take) || isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-5 fixed bottom-6 left-1/2 z-50 w-[92%] max-w-2xl -translate-x-1/2 duration-300">
          <div className="border-border bg-card/95 flex flex-col gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-md md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">Bulk actions</p>
                <p className="text-muted-foreground text-xs">
                  {selectedIds.length} selected
                  {selectedActiveCount > 0 && selectedSuspendedCount > 0
                    ? ` (${selectedActiveCount} active, ${selectedSuspendedCount} suspended)`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedActiveCount > 0 && (
                <button
                  type="button"
                  disabled={bulkStatusMutation.isPending}
                  onClick={() =>
                    setBulkConfirm({
                      suspend: true,
                      ids: selectedOrgs.filter((o) => o.status !== 'suspended').map((o) => o.id),
                    })
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Suspend ({selectedActiveCount})
                </button>
              )}
              {selectedSuspendedCount > 0 && (
                <button
                  type="button"
                  disabled={bulkStatusMutation.isPending}
                  onClick={() =>
                    setBulkConfirm({
                      suspend: false,
                      ids: selectedOrgs.filter((o) => o.status === 'suspended').map((o) => o.id),
                    })
                  }
                  className={`${actionButtonStyles.success} ${actionButtonStyles.successLg}`}
                >
                  Restore ({selectedSuspendedCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="border-border text-muted-foreground hover:bg-muted inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(val) => !val && setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.description ?? ''}
        confirmText={confirmAction?.variant === 'destructive' ? 'Confirm' : 'Confirm'}
        variant={confirmAction?.variant}
        onConfirm={() => confirmAction?.onConfirm()}
      />

      <ConfirmDialog
        open={!!bulkConfirm}
        onOpenChange={(val) => !val && setBulkConfirm(null)}
        title={
          bulkConfirm?.suspend
            ? `Suspend ${bulkConfirm.ids.length} organizations`
            : `Restore ${bulkConfirm?.ids.length ?? 0} organizations`
        }
        description={
          bulkConfirm?.suspend
            ? `This will immediately disable dashboards and portals for: ${bulkConfirmNames.join(', ')}${bulkConfirmExtra > 0 ? ` and ${bulkConfirmExtra} more` : ''}. Users will not be able to sign in until restored.`
            : `Re-enable access for: ${bulkConfirmNames.join(', ')}${bulkConfirmExtra > 0 ? ` and ${bulkConfirmExtra} more` : ''}.`
        }
        confirmText={bulkConfirm?.suspend ? 'Suspend all' : 'Restore all'}
        variant={bulkConfirm?.suspend ? 'destructive' : 'default'}
        onConfirm={() => {
          if (!bulkConfirm) return;
          bulkStatusMutation.mutate({
            organizationIds: bulkConfirm.ids,
            suspend: bulkConfirm.suspend,
          });
        }}
      />

      {impersonationTarget && (
        <ImpersonationDialog
          open
          onOpenChange={(open) => {
            if (!open) setImpersonationTarget(null);
          }}
          orgId={impersonationTarget.orgId}
          orgName={impersonationTarget.orgName}
        />
      )}
    </div>
  );
}
