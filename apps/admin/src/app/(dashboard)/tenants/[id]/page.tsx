'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Building2,
  Globe,
  MapPin,
  Briefcase,
  Clock,
  CheckCircle2,
  CreditCard,
  Users,
  MessageSquare,
  AlertTriangle,
  Layers,
  Settings,
  Power,
  ExternalLink,
  Trash2,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { resolveLoyaltyAppUrl, DEFAULT_SUPPORT_EMAIL } from '@queueplatform/shared';
import type { SystemRole } from '@queueplatform/shared';
import { toast } from 'sonner';
import { ConfirmDialog } from '@queueplatform/frontend-core';
import { ImpersonationDialog } from '@/components/impersonation-dialog';
import { DeleteOrganizationDialog } from '@/components/tenants/delete-organization-dialog';
import { TenantUsersPanel } from '@/components/tenants/tenant-users-panel';
import {
  BillingPlanOption,
  formatOnboardingStep,
  formatProductSku,
  formatTenantPlanLabel,
  formatTenantPlanSlug,
  isProtectedPlatformOrg,
  SETUP_MODE_PLAN_LABEL,
} from '@/components/tenants/tenant-page-helpers';
import { cn } from '@/lib/utils';
import { tenantQueryKeys } from '@/lib/tenant-query-keys';
import {
  patchTenantPlanInCaches,
  patchTenantStatusInCaches,
  patchTenantVisitJourneysInCaches,
  patchTenantAppointmentsInCaches,
  patchTenantPatronCrmInCaches,
  type TenantsListPayload,
} from '@/lib/tenant-mutation-cache';

type DetailedOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  onboardingStep: string;
  createdAt: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  timezone: string;
  productSku: string;
  ownerEmail: string | null;
  visitJourneysEnabled: boolean;
  appointmentsEnabled: boolean;
  patronCrmEnabled: boolean;
  stripeCustomerId?: string | null;
  _count: {
    branches: number;
    users: number;
    queues: number;
    tickets: number;
  };
  subscriptions: {
    status: string;
    stripeSubscriptionId?: string | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
    plan: {
      name: string;
      slug: string;
    };
    pendingPlan?: { name: string; slug: string } | null;
  }[];
  smsCreditPurchases: {
    id: string;
    packSlug: string;
    messages: number;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
  }[];
  invoices: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    issuedAt: string;
    dueAt?: string;
    paidAt?: string | null;
  }[];
  billingOps?: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeCustomerUrl: string | null;
    stripeSubscriptionUrl: string | null;
    subscriptionStatus: string | null;
    pastDue: boolean;
    pendingCouponCode: string | null;
    lastCouponCode?: string | null;
    couponAppliedAt: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    pendingPlan: { name: string; slug: string } | null;
    complimentaryAccess?: boolean;
    complimentaryEndsAt?: string | null;
    subscriptionHistory: {
      id: string;
      status: string;
      createdAt: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
      stripeSubscriptionId: string | null;
      plan: { name: string; slug: string };
    }[];
    failedPayments: {
      id: string;
      status: string;
      amount: number | null;
      paymentProvider: string;
      providerRef: string;
      attemptCount?: number | null;
      createdAt: string;
      source?: string;
    }[];
    overdueInvoices?: {
      id: string;
      amount: number;
      currency: string;
      status: string;
      issuedAt: string;
      dueAt?: string;
    }[];
    failedSmsPurchases?: {
      id: string;
      packSlug: string;
      messages: number;
      amountCents: number;
      status: string;
      createdAt: string;
    }[];
  };
  smsOps?: {
    used: number;
    allowance: { planBase: number; purchasedBonus: number; effectiveLimit: number };
    remaining: number;
    pendingSms: number;
    failedSms24h: number;
  };
  supportSummary?: {
    openCount: number;
    overdueCount: number;
    latest: {
      id: string;
      subject: string;
      status: string;
      priority: string;
      dueAt: string | null;
      createdAt: string;
    }[];
  };
  accountSetup?: {
    paid: boolean;
    paidAt: string | null;
    amountCents: number | null;
  };
};

type DeploymentFeatures = {
  visitJourneysGloballyDisabled: boolean;
  visitJourneysLegacyGlobalOn: boolean;
};

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [accountSetupLink, setAccountSetupLink] = useState<string | null>(null);
  const [creatingAccountSetup, setCreatingAccountSetup] = useState(false);
  const [impersonationOpen, setImpersonationOpen] = useState(false);
  const [impersonationInitialRole, setImpersonationInitialRole] = useState<SystemRole | 'full'>(
    'full',
  );
  const [complimentaryEndsLocal, setComplimentaryEndsLocal] = useState('');
  const [grantingComplimentary, setGrantingComplimentary] = useState(false);
  const [revokingComplimentary, setRevokingComplimentary] = useState(false);

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'billing' | 'settings'>(
    'overview',
  );
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    slug: '',
    website: '',
    industry: '',
    timezone: 'UTC',
    country: '',
  });

  const tenantKey = tenantQueryKeys.detail(id);

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
    data: org,
    isLoading,
    isError,
  } = useQuery({
    queryKey: tenantKey,
    queryFn: () =>
      api
        .get<{ data: DetailedOrganization }>(`/platform-admin/tenants/${id}`, { token: token! })
        .then((r) => r?.data),
    enabled: !!token && !!id,
    retry: false,
  });

  useEffect(() => {
    const endsAt = org?.billingOps?.complimentaryEndsAt;
    if (!endsAt) return;
    const end = new Date(endsAt);
    if (Number.isNaN(end.getTime())) return;
    // Prefill datetime-local when extending an existing grant.
    if (end.getTime() > Date.now()) {
      setComplimentaryEndsLocal(toLocalDatetimeInputValue(end));
    }
  }, [org?.billingOps?.complimentaryEndsAt]);

  const { data: billingPlans = [] } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () =>
      api
        .get<{ data: BillingPlanOption[] }>('/billing/plans', { token: token! })
        .then((r) => r?.data ?? []),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const suspendMutation = useMutation({
    mutationFn: (suspend: boolean) =>
      api.patch(`/platform-admin/tenants/${id}/suspend`, { suspend }, { token: token! }),
    onMutate: async (suspend) => {
      await queryClient.cancelQueries({ queryKey: tenantKey });
      await queryClient.cancelQueries({ queryKey: tenantQueryKeys.all });
      const previousDetail = queryClient.getQueryData<DetailedOrganization>(tenantKey);
      const previousLists = queryClient.getQueriesData<TenantsListPayload>({
        queryKey: tenantQueryKeys.all,
      });
      patchTenantStatusInCaches(queryClient, id, suspend);
      return { previousDetail, previousLists };
    },
    onError: (_err, _suspend, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(tenantKey, context.previousDetail);
      }
      for (const [key, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error('Failed to update tenant status');
    },
    onSuccess: (_, suspend) => {
      toast.success(suspend ? 'Organization suspended' : 'Organization restored');
      setConfirmSuspend(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey });
      queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: typeof editData) =>
      api.patch(`/platform-admin/tenants/${id}`, data, { token: token! }),
    onSuccess: () => {
      toast.success('Tenant profile updated successfully');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: tenantKey });
      queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update profile');
    },
  });

  const handleEditClick = () => {
    if (!org) return;
    setEditData({
      name: org.name || '',
      slug: org.slug || '',
      website: org.website || '',
      industry: org.industry || '',
      timezone: org.timezone || 'UTC',
      country: org.country || '',
    });
    setIsEditing(true);
  };

  const planMutation = useMutation({
    mutationFn: (planSlug: string) =>
      api.patch(`/platform-admin/tenants/${id}/plan`, { planSlug }, { token: token! }),
    onMutate: async (planSlug) => {
      await queryClient.cancelQueries({ queryKey: tenantKey });
      await queryClient.cancelQueries({ queryKey: tenantQueryKeys.all });
      const previousDetail = queryClient.getQueryData<DetailedOrganization>(tenantKey);
      const previousLists = queryClient.getQueriesData<TenantsListPayload>({
        queryKey: tenantQueryKeys.all,
      });
      const planName = billingPlans.find((p) => p.slug === planSlug)?.name;
      patchTenantPlanInCaches(queryClient, id, planSlug, planName);
      return { previousDetail, previousLists };
    },
    onError: (_err, _planSlug, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(tenantKey, context.previousDetail);
      }
      for (const [key, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error('Failed to update subscription plan');
    },
    onSuccess: () => {
      toast.success('Plan updated successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey });
      queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    },
  });

  const applyComplimentaryPreset = (days: number) => {
    const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setComplimentaryEndsLocal(toLocalDatetimeInputValue(end));
  };

  const grantComplimentary = async () => {
    if (!token || !complimentaryEndsLocal) {
      toast.error('Choose an end date/time first');
      return;
    }
    const endsAt = new Date(complimentaryEndsLocal);
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
      toast.error('End time must be in the future');
      return;
    }
    setGrantingComplimentary(true);
    try {
      await api.post(
        `/platform-admin/tenants/${id}/complimentary-access`,
        { endsAt: endsAt.toISOString(), planSlug: 'starter' },
        { token },
      );
      toast.success('Complimentary Starter access granted');
      await queryClient.invalidateQueries({ queryKey: tenantKey });
      await queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to grant complimentary access');
    } finally {
      setGrantingComplimentary(false);
    }
  };

  const revokeComplimentary = async () => {
    if (!token) return;
    setRevokingComplimentary(true);
    try {
      await api.delete(`/platform-admin/tenants/${id}/complimentary-access`, { token });
      toast.success('Complimentary access revoked — ops blocked until they subscribe');
      await queryClient.invalidateQueries({ queryKey: tenantKey });
      await queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke complimentary access');
    } finally {
      setRevokingComplimentary(false);
    }
  };
  const visitJourneysMutation = useMutation({
    mutationFn: (visitJourneysEnabled: boolean) =>
      api.patch(
        `/platform-admin/tenants/${id}/visit-journeys`,
        { visitJourneysEnabled },
        { token: token! },
      ),
    onMutate: async (visitJourneysEnabled) => {
      await queryClient.cancelQueries({ queryKey: tenantKey });
      await queryClient.cancelQueries({ queryKey: tenantQueryKeys.all });
      const previousDetail = queryClient.getQueryData<DetailedOrganization>(tenantKey);
      const previousLists = queryClient.getQueriesData<TenantsListPayload>({
        queryKey: tenantQueryKeys.all,
      });
      patchTenantVisitJourneysInCaches(queryClient, id, visitJourneysEnabled);
      return { previousDetail, previousLists };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(tenantKey, context.previousDetail);
      }
      for (const [key, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error('Could not update visit journeys');
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? 'Visit journeys enabled' : 'Visit journeys disabled');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey });
      queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    },
  });

  const appointmentsMutation = useMutation({
    mutationFn: (appointmentsEnabled: boolean) =>
      api.patch(
        `/platform-admin/tenants/${id}/appointments`,
        { appointmentsEnabled },
        { token: token! },
      ),
    onMutate: async (appointmentsEnabled) => {
      await queryClient.cancelQueries({ queryKey: tenantKey });
      await queryClient.cancelQueries({ queryKey: tenantQueryKeys.all });
      const previousDetail = queryClient.getQueryData<DetailedOrganization>(tenantKey);
      const previousLists = queryClient.getQueriesData<TenantsListPayload>({
        queryKey: tenantQueryKeys.all,
      });
      patchTenantAppointmentsInCaches(queryClient, id, appointmentsEnabled);
      return { previousDetail, previousLists };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(tenantKey, context.previousDetail);
      }
      for (const [key, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error('Could not update appointments module');
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? 'Appointments module enabled' : 'Appointments module disabled');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey });
      queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    },
  });

  const patronCrmMutation = useMutation({
    mutationFn: (patronCrmEnabled: boolean) =>
      api.patch(
        `/platform-admin/tenants/${id}/patron-crm`,
        { patronCrmEnabled },
        { token: token! },
      ),
    onMutate: async (patronCrmEnabled) => {
      await queryClient.cancelQueries({ queryKey: tenantKey });
      await queryClient.cancelQueries({ queryKey: tenantQueryKeys.all });
      const previousDetail = queryClient.getQueryData<DetailedOrganization>(tenantKey);
      const previousLists = queryClient.getQueriesData<TenantsListPayload>({
        queryKey: tenantQueryKeys.all,
      });
      patchTenantPatronCrmInCaches(queryClient, id, patronCrmEnabled);
      return { previousDetail, previousLists };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(tenantKey, context.previousDetail);
      }
      for (const [key, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error('Could not update Patron CRM');
    },
    onSuccess: (_, enabled) => {
      toast.success(enabled ? 'Patron CRM enabled' : 'Patron CRM disabled');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey });
      queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    },
  });

  const handleImpersonate = (role: SystemRole | 'full' = 'full') => {
    if (!org) return;
    setImpersonationInitialRole(role);
    setImpersonationOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Failed to load tenant</h3>
          <p className="mt-1 text-sm text-slate-500">
            The tenant might not exist or there was a server error.
          </p>
        </div>
        <button
          onClick={() => router.push('/tenants')}
          className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isSuspended = org.status === 'suspended';
  const isPlatformOrg = isProtectedPlatformOrg(org.slug);
  const platformVisitLocked = deploymentFeatures?.visitJourneysGloballyDisabled === true;
  const platformVisitLegacyGlobal = deploymentFeatures?.visitJourneysLegacyGlobalOn === true;
  const activeSubscription = org.subscriptions?.[0];
  const currentPlan = formatTenantPlanSlug(activeSubscription);
  const currentPlanName = formatTenantPlanLabel(activeSubscription);
  const planOptions =
    currentPlan && !billingPlans.some((p) => p.slug === currentPlan)
      ? [
          ...billingPlans,
          {
            slug: currentPlan,
            name: activeSubscription?.plan?.name || currentPlan,
          },
        ]
      : billingPlans;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/tenants"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
                isSuspended ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700',
              )}
            >
              {isSuspended ? 'Suspended' : 'Active'}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span className="font-mono">{org.slug}</span>
            <span>&bull;</span>
            <span>
              Created{' '}
              {new Date(org.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {org.billingOps?.stripeCustomerUrl ? (
            <a
              href={org.billingOps.stripeCustomerUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Stripe
            </a>
          ) : null}
          <button
            onClick={() => handleImpersonate()}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Users className="h-4 w-4" />
            Impersonate
          </button>
          {!isPlatformOrg && (
            <>
              <button
                onClick={() => setConfirmSuspend(true)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm',
                  isSuspended
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'bg-amber-600 text-white hover:bg-amber-500',
                )}
              >
                <Power className="h-4 w-4" />
                {isSuspended ? 'Restore Organization' : 'Suspend Organization'}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500"
              >
                <Trash2 className="h-4 w-4" />
                Delete Organization
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/25">
        <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
          What this tenant sees
        </h2>
        <p className="mt-2 text-sm text-indigo-950/90 dark:text-indigo-100/90">
          Tenant web at <span className="font-mono text-xs">{org.slug}</span> — staff use{' '}
          <span className="font-medium">Serve customers</span> for walk-in and multi-step queues.
          Patrons use kiosk, track links, and lobby TV. Impersonation opens the same surfaces with a
          persistent banner; the tenant does not see platform-admin controls.
        </p>
        <ul className="mt-3 grid gap-2 text-xs text-indigo-900/80 sm:grid-cols-2 dark:text-indigo-100/80">
          <li>
            Plan: <span className="font-semibold">{currentPlanName}</span>
          </li>
          <li>
            Product: <span className="font-semibold">{formatProductSku(org.productSku)}</span>
          </li>
          <li>
            Multi-step:{' '}
            <span className="font-semibold">{org.visitJourneysEnabled ? 'Enabled' : 'Off'}</span>
          </li>
          <li>
            Branches / queues:{' '}
            <span className="font-semibold">
              {org._count.branches} / {org._count.queues}
            </span>
          </li>
          <li>
            Users: <span className="font-semibold">{org._count.users}</span>
          </li>
          <li>
            Appointments:{' '}
            <span className="font-semibold">{org.appointmentsEnabled ? 'Enabled' : 'Off'}</span>
          </li>
        </ul>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(['overview', 'users', 'billing', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors',
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Billing
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Details
                  </button>
                </div>
                <p className="mt-2 text-lg font-bold text-slate-900">{currentPlanName}</p>
                <p
                  className={cn(
                    'mt-1 text-xs font-medium capitalize',
                    org.billingOps?.pastDue ? 'text-red-600' : 'text-slate-500',
                  )}
                >
                  {org.billingOps?.subscriptionStatus ?? 'no subscription'}
                  {org.billingOps?.pastDue ? ' · past due' : ''}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">SMS</h3>
                  <MessageSquare className="h-4 w-4 text-slate-300" />
                </div>
                <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">
                  {org.smsOps
                    ? `${org.smsOps.used.toLocaleString()} / ${org.smsOps.allowance.effectiveLimit.toLocaleString()}`
                    : '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {org.smsOps
                    ? `${org.smsOps.remaining.toLocaleString()} remaining · ${org.smsOps.failedSms24h} failed 24h`
                    : 'Usage unavailable'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Support
                  </h3>
                  <Link
                    href={`/support?orgId=${org.id}`}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    View tickets
                  </Link>
                </div>
                <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">
                  {org.supportSummary?.openCount ?? 0} open
                </p>
                <p
                  className={cn(
                    'mt-1 text-xs',
                    (org.supportSummary?.overdueCount ?? 0) > 0
                      ? 'font-medium text-red-600'
                      : 'text-slate-500',
                  )}
                >
                  {org.supportSummary?.overdueCount ?? 0} overdue SLA
                </p>
                {(org.supportSummary?.latest?.length ?? 0) > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                    {org.supportSummary!.latest.slice(0, 3).map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/support/${t.id}`}
                          className="block truncate text-xs text-indigo-600 hover:underline"
                        >
                          {t.subject}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Tenant Profile</h3>
                  <button
                    onClick={handleEditClick}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
                  >
                    Edit Profile
                  </button>
                </div>
                <dl className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <dt className="flex items-center gap-2 text-sm text-slate-500">
                      <Mail className="h-4 w-4" /> Email
                    </dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {org.ownerEmail ? (
                        <a
                          href={`mailto:${org.ownerEmail}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {org.ownerEmail}
                        </a>
                      ) : (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <dt className="flex items-center gap-2 text-sm text-slate-500">
                      <Globe className="h-4 w-4" /> Website
                    </dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {org.website ? (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {org.website}
                        </a>
                      ) : (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <dt className="flex items-center gap-2 text-sm text-slate-500">
                      <Briefcase className="h-4 w-4" /> Industry
                    </dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {org.industry || <span className="text-slate-400">Not set</span>}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <dt className="flex items-center gap-2 text-sm text-slate-500">
                      <MapPin className="h-4 w-4" /> Country
                    </dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {org.country || <span className="text-slate-400">Not set</span>}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <dt className="flex items-center gap-2 text-sm text-slate-500">
                      <Clock className="h-4 w-4" /> Timezone
                    </dt>
                    <dd className="text-sm font-medium text-slate-900">{org.timezone}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <dt className="flex items-center gap-2 text-sm text-slate-500">
                      <CheckCircle2 className="h-4 w-4" /> Onboarding Step
                    </dt>
                    <dd className="text-sm font-medium capitalize text-slate-900">
                      {formatOnboardingStep(org.onboardingStep)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-slate-900">Platform Usage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <Building2 className="h-4 w-4" /> Branches
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{org._count.branches}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2 text-sm font-medium text-slate-500">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Users
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('users')}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{org._count.users}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <Layers className="h-4 w-4" /> Queues
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{org._count.queues}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <CheckCircle2 className="h-4 w-4" /> Tickets
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{org._count.tickets}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && token && (
          <TenantUsersPanel
            orgId={org.id}
            token={token}
            onImpersonateUser={(role) => handleImpersonate(role)}
          />
        )}

        {activeTab === 'billing' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Mail className="h-5 w-5 text-slate-400" /> Account Setup — $100 CAD
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    One-time fee for us to configure their account. When they pay,{' '}
                    <span className="font-medium text-slate-700">{DEFAULT_SUPPORT_EMAIL}</span> is
                    emailed and a Support ticket appears on this admin dashboard.
                  </p>
                  {org.accountSetup?.paid ? (
                    <p className="mt-2 text-sm font-semibold text-emerald-700">
                      Paid
                      {org.accountSetup.paidAt
                        ? ` · ${new Date(org.accountSetup.paidAt).toLocaleString()}`
                        : ''}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-amber-700">Not paid yet</p>
                  )}
                </div>
                {!org.accountSetup?.paid ? (
                  <button
                    type="button"
                    disabled={creatingAccountSetup}
                    onClick={async () => {
                      setCreatingAccountSetup(true);
                      try {
                        const res = await api.post<{
                          success: boolean;
                          data: { url: string; sessionId: string };
                        }>(
                          `/platform-admin/tenants/${id}/account-setup-checkout`,
                          {},
                          { token: token! },
                        );
                        const url = res.data?.url;
                        if (!url) throw new Error('Checkout URL missing');
                        setAccountSetupLink(url);
                        await navigator.clipboard.writeText(url);
                        toast.success('Checkout link copied — send it to the customer');
                      } catch (err: unknown) {
                        toast.error(
                          err instanceof Error ? err.message : 'Could not create checkout link',
                        );
                      } finally {
                        setCreatingAccountSetup(false);
                      }
                    }}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {creatingAccountSetup ? 'Creating…' : 'Create $100 checkout link'}
                  </button>
                ) : null}
              </div>
              {accountSetupLink ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Checkout URL
                  </p>
                  <a
                    href={accountSetupLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 break-all text-sm font-medium text-indigo-600 hover:underline"
                  >
                    {accountSetupLink}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Clock className="h-5 w-5 text-slate-400" /> Complimentary Starter
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    Grant free Starter access until a chosen end time. After it ends, the tenant
                    stays on Starter but cannot issue tickets, call customers, or take appointments
                    until they subscribe via Stripe.
                  </p>
                  {org.billingOps?.complimentaryAccess && org.billingOps.complimentaryEndsAt ? (
                    <p
                      className={cn(
                        'mt-3 text-sm font-semibold',
                        new Date(org.billingOps.complimentaryEndsAt).getTime() > Date.now()
                          ? 'text-emerald-700'
                          : 'text-amber-700',
                      )}
                    >
                      {new Date(org.billingOps.complimentaryEndsAt).getTime() > Date.now()
                        ? `Active until ${new Date(org.billingOps.complimentaryEndsAt).toLocaleString()}`
                        : `Ended ${new Date(org.billingOps.complimentaryEndsAt).toLocaleString()} — ops blocked`}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm font-medium text-slate-500">
                      No complimentary grant
                    </p>
                  )}
                </div>
                <div className="flex w-full max-w-md flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {[7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => applyComplimentaryPreset(days)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                  <label className="block text-xs font-medium text-slate-600">
                    Ends at
                    <input
                      type="datetime-local"
                      value={complimentaryEndsLocal}
                      onChange={(e) => setComplimentaryEndsLocal(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={grantingComplimentary || !complimentaryEndsLocal}
                      onClick={() => void grantComplimentary()}
                      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {grantingComplimentary ? 'Granting…' : 'Grant / Extend'}
                    </button>
                    {org.billingOps?.complimentaryAccess ? (
                      <button
                        type="button"
                        disabled={revokingComplimentary}
                        onClick={() => {
                          if (
                            !window.confirm(
                              'Revoke complimentary access now? The tenant will immediately be unable to issue tickets, call customers, or take appointments until they subscribe.',
                            )
                          ) {
                            return;
                          }
                          void revokeComplimentary();
                        }}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {revokingComplimentary ? 'Revoking…' : 'Revoke now'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">Subscription</h3>
                {org.billingOps?.stripeCustomerUrl ? (
                  <a
                    href={org.billingOps.stripeCustomerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Stripe Customer <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
              {org.billingOps?.pastDue ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  Past due / payment risk — check Stripe and failed payments below.
                </div>
              ) : null}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Current Plan</label>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                      <CreditCard className="h-4 w-4" /> {currentPlanName}
                    </span>
                    {(org.billingOps?.subscriptionStatus ?? org.subscriptions?.[0]?.status) && (
                      <span
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-sm font-medium capitalize',
                          org.billingOps?.pastDue
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {org.billingOps?.subscriptionStatus ?? org.subscriptions[0].status}
                      </span>
                    )}
                  </div>
                  {org.billingOps?.currentPeriodEnd ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Period ends {new Date(org.billingOps.currentPeriodEnd).toLocaleString()}
                      {org.billingOps.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                    </p>
                  ) : null}
                  {org.billingOps?.pendingPlan ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Pending change → {org.billingOps.pendingPlan.name}
                    </p>
                  ) : null}
                  {org.billingOps?.pendingCouponCode ? (
                    <p className="mt-1 text-xs text-slate-600">
                      Pending coupon{' '}
                      <span className="font-mono">{org.billingOps.pendingCouponCode}</span>
                    </p>
                  ) : org.billingOps?.lastCouponCode && org.billingOps.couponAppliedAt ? (
                    <p className="mt-1 text-xs text-slate-600">
                      Applied coupon{' '}
                      <span className="font-mono">{org.billingOps.lastCouponCode}</span>
                      {` · ${new Date(org.billingOps.couponAppliedAt).toLocaleDateString()}`}
                    </p>
                  ) : null}
                  {org.billingOps?.stripeSubscriptionUrl ? (
                    <a
                      href={org.billingOps.stripeSubscriptionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Open Stripe subscription <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Override Plan
                  </label>
                  <select
                    value={currentPlan}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      planMutation.mutate(e.target.value);
                    }}
                    disabled={planMutation.isPending || planOptions.length === 0}
                    className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {!currentPlan && (
                      <option value="" disabled>
                        {SETUP_MODE_PLAN_LABEL}
                      </option>
                    )}
                    {planOptions.map((plan) => (
                      <option key={plan.slug} value={plan.slug}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Permanent override (not time-boxed). Prefer Complimentary Starter above for free
                    trials. This bypasses Stripe.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">SMS credits</h3>
              {org.smsOps ? (
                <div className="space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-2xl font-bold tabular-nums text-slate-900">
                        {org.smsOps.used.toLocaleString()}
                        <span className="text-base font-medium text-slate-400">
                          {' '}
                          / {org.smsOps.allowance.effectiveLimit.toLocaleString()}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Lifetime used · {org.smsOps.remaining.toLocaleString()} remaining
                      </p>
                    </div>
                    <MessageSquare className="h-8 w-8 text-indigo-300" />
                  </div>
                  <p className="text-xs text-slate-500">
                    Plan base {org.smsOps.allowance.planBase.toLocaleString()} + purchased{' '}
                    {org.smsOps.allowance.purchasedBonus.toLocaleString()}
                  </p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-slate-600">
                      Pending: <strong>{org.smsOps.pendingSms}</strong>
                    </span>
                    <span
                      className={org.smsOps.failedSms24h > 0 ? 'text-red-600' : 'text-slate-600'}
                    >
                      Failed 24h: <strong>{org.smsOps.failedSms24h}</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">SMS usage unavailable.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Invoices & payments</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Recent invoices
                  </h4>
                  {org.invoices.length === 0 ? (
                    <p className="text-sm text-slate-500">No invoices yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {org.invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {inv.currency} {Number(inv.amount).toFixed(2)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {new Date(inv.issuedAt).toLocaleDateString()}
                              {inv.dueAt
                                ? ` · due ${new Date(inv.dueAt).toLocaleDateString()}`
                                : ''}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                              inv.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : inv.status === 'overdue'
                                  ? 'bg-red-50 text-red-700'
                                  : inv.status === 'void'
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-amber-50 text-amber-700',
                            )}
                          >
                            {inv.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Payment failures
                  </h4>
                  {(org.billingOps?.failedPayments?.length ?? 0) === 0 &&
                  (org.billingOps?.failedSmsPurchases?.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-500">No payment failures recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {org.billingOps?.failedPayments?.map((pay) => (
                        <div
                          key={pay.id}
                          className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-red-900">
                              Invoice payment failed
                            </p>
                            <span className="text-[10px] font-bold uppercase text-red-700">
                              {pay.status}
                            </span>
                          </div>
                          <p className="mt-0.5 font-mono text-[10px] text-red-700/80">
                            {pay.providerRef}
                            {pay.attemptCount != null ? ` · attempt ${pay.attemptCount}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(pay.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                      {org.billingOps?.failedSmsPurchases?.map((pack) => (
                        <div
                          key={pack.id}
                          className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-red-900">
                              SMS pack {pack.packSlug} failed
                            </p>
                            <span className="text-[10px] font-bold uppercase text-red-700">
                              {pack.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            ${(pack.amountCents / 100).toFixed(2)} ·{' '}
                            {new Date(pack.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {(org.billingOps?.subscriptionHistory?.length ?? 0) > 0 ? (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Plan history
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                          <th className="py-1 pr-3">Plan</th>
                          <th className="py-1 pr-3">Status</th>
                          <th className="py-1 pr-3">Period</th>
                          <th className="py-1">Started</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {org.billingOps!.subscriptionHistory.map((sub) => (
                          <tr key={sub.id}>
                            <td className="py-2 pr-3 font-medium text-slate-800">
                              {sub.plan.name}
                            </td>
                            <td className="py-2 pr-3 capitalize text-slate-600">{sub.status}</td>
                            <td className="py-2 pr-3 text-slate-500">
                              {new Date(sub.currentPeriodStart).toLocaleDateString()} –{' '}
                              {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                            </td>
                            <td className="py-2 text-slate-500">
                              {new Date(sub.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-900">Recent SMS Purchases</h3>
              {org.smsCreditPurchases.length === 0 ? (
                <p className="text-sm text-slate-500">No SMS packs purchased yet.</p>
              ) : (
                <div className="space-y-3">
                  {org.smsCreditPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5 text-indigo-400" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            +{purchase.messages.toLocaleString()} SMS
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(purchase.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">
                          ${(purchase.amountCents / 100).toFixed(2)}
                        </p>
                        <p
                          className={cn(
                            'text-xs font-medium capitalize',
                            purchase.status === 'completed' ? 'text-emerald-600' : 'text-slate-500',
                          )}
                        >
                          {purchase.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-4">
            {platformVisitLocked ? (
              <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                <p>
                  Multi-step visits are disabled platform-wide (
                  <code className="text-xs">FEATURE_VISIT_JOURNEYS=false</code>). Per-tenant toggles
                  have no effect until ops changes the API environment.
                </p>
              </div>
            ) : null}
            {platformVisitLegacyGlobal && !platformVisitLocked ? (
              <div className="flex gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
                <AlertTriangle className="h-5 w-5 shrink-0 text-indigo-600" />
                <p>
                  Multi-step visits are forced on for every tenant (
                  <code className="text-xs">FEATURE_VISIT_JOURNEYS=true</code>). Per-tenant toggles
                  are locked.
                </p>
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <Settings className="h-5 w-5 text-slate-400" /> Operational Features
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Module toggles for this tenant. Changes apply immediately.
                </p>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">Multi-step visit</h4>
                    <p className="text-sm text-slate-500">
                      Allow multi-step visit journeys at kiosk and staff issuance.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={org.visitJourneysEnabled}
                      onChange={(e) => visitJourneysMutation.mutate(e.target.checked)}
                      disabled={
                        visitJourneysMutation.isPending ||
                        isSuspended ||
                        platformVisitLocked ||
                        platformVisitLegacyGlobal ||
                        deploymentFeatures === undefined
                      }
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-indigo-800"></div>
                  </label>
                </div>
              </div>
              <div className="border-t border-slate-100 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">Appointments</h4>
                    <p className="text-sm text-slate-500">
                      Enable the appointment booking module for this tenant.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={org.appointmentsEnabled}
                      onChange={(e) => appointmentsMutation.mutate(e.target.checked)}
                      disabled={appointmentsMutation.isPending || isSuspended}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-indigo-800"></div>
                  </label>
                </div>
              </div>
              <div className="border-t border-slate-100 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">Patron CRM</h4>
                    <p className="text-sm text-slate-500">
                      Allow this tenant to use the patron directory, profiles, segments, and
                      marketing consent tools.
                    </p>
                    {org.patronCrmEnabled ? (
                      <a
                        href={resolveLoyaltyAppUrl()}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Open Patron Loyalty
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={org.patronCrmEnabled}
                      onChange={(e) => patronCrmMutation.mutate(e.target.checked)}
                      disabled={patronCrmMutation.isPending || isSuspended}
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:border-slate-600 dark:bg-slate-700 dark:peer-focus:ring-indigo-800"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title={isSuspended ? 'Restore Organization' : 'Suspend Organization'}
        description={
          isSuspended
            ? `Are you sure you want to restore "${org.name}"? This will re-enable all branch and customer portals for this organization.`
            : `Are you sure you want to suspend "${org.name}"? This will immediately disable all portals and dashboards for this organization and all their users.`
        }
        confirmText={isSuspended ? 'Restore' : 'Suspend'}
        variant={isSuspended ? 'default' : 'destructive'}
        onConfirm={() => suspendMutation.mutate(!isSuspended)}
      />

      <DeleteOrganizationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        orgId={org.id}
        orgName={org.name}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
          queryClient.removeQueries({ queryKey: tenantKey });
          router.push('/tenants');
        }}
      />

      {isEditing && org && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Edit Profile</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProfileMutation.mutate(editData);
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  required
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
                <input
                  type="text"
                  required
                  value={editData.slug}
                  onChange={(e) => setEditData({ ...editData, slug: e.target.value.toLowerCase() })}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Website</label>
                <input
                  type="url"
                  value={editData.website}
                  onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Industry</label>
                <input
                  type="text"
                  value={editData.industry}
                  onChange={(e) => setEditData({ ...editData, industry: e.target.value })}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Country Code
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={editData.country}
                    onChange={(e) =>
                      setEditData({ ...editData, country: e.target.value.toUpperCase() })
                    }
                    className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="US"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Timezone</label>
                  <input
                    type="text"
                    required
                    value={editData.timezone}
                    onChange={(e) => setEditData({ ...editData, timezone: e.target.value })}
                    className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="UTC"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  disabled={updateProfileMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {org && (
        <ImpersonationDialog
          open={impersonationOpen}
          onOpenChange={setImpersonationOpen}
          orgId={org.id}
          orgName={org.name}
          initialRole={impersonationInitialRole}
        />
      )}
    </div>
  );
}
