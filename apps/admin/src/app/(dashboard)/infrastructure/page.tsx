'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Server,
  Activity,
  RefreshCw,
  ShieldCheck,
  Radio,
  MessageSquare,
  Rocket,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { getApiBase } from '@queueplatform/shared';

type DeploymentFeatures = {
  visitJourneysGloballyDisabled: boolean;
  visitJourneysLegacyGlobalOn: boolean;
};

type DeploymentStatus = {
  release: string;
  environment: string;
  runMigrationsOnStart: boolean;
  lastAppliedMigration: { name: string; finishedAt: string | null } | null;
  recentMigrations: {
    name: string;
    finishedAt: string | null;
    startedAt: string | null;
    appliedStepsCount: number;
    rolledBackAt: string | null;
  }[];
  migrationsError: string | null;
  opsLinks?: {
    sentry: string;
    betterStackUptime: string;
    betterStackStatus: string;
    betterStackLogs?: string;
  };
  note: string;
};

type SmsHealth = {
  notificationsWorker: {
    status: 'ok' | 'down';
    reason: string | null;
    ageMs: number | null;
  };
  twilio: {
    accountSidConfigured: boolean;
    accountSidMasked: string | null;
    authTokenConfigured: boolean;
    apiKeyConfigured: boolean;
    messagingServiceSidConfigured: boolean;
    messagingServiceSidMasked: string | null;
    phoneNumberConfigured: boolean;
    statusCallbackConfigured: boolean;
    a2pNote: string;
  };
  twilioBalance?: {
    balanceUsd: number | null;
    currency: string | null;
    level: 'ok' | 'warn' | 'critical' | 'unknown';
    warnBelowUsd: number;
    criticalBelowUsd: number;
    error: string | null;
  };
  smsPackPrices?: {
    allConfigured: boolean;
    missingEnvKeys: string[];
  };
  warnings?: string[];
  alertLevel?: 'ok' | 'warn' | 'critical';
  sends24h: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    byStatus: Record<string, number>;
  };
  topTenants: {
    orgId: string;
    name: string;
    slug: string | null;
    sends24h: number;
    used: number;
    allowance: { planBase: number; purchasedBonus: number; effectiveLimit: number };
    remaining: number;
  }[];
  note: string;
};

type QueueSnapshot = {
  name: string;
  ok: boolean;
  depth: number;
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
  };
  lastErrors: {
    id: string | null;
    name: string;
    failedReason: string | null;
    attemptsMade: number;
    timestamp: string | null;
    finishedOn: string | null;
  }[];
  error: string | null;
};

type SmsOps = {
  queues: {
    notifications: QueueSnapshot;
    notificationsDead: QueueSnapshot;
    scheduledJobs: QueueSnapshot;
  };
  deadLetter: {
    ok: boolean;
    count: number;
    error: string | null;
    jobs: {
      id: string | null;
      notificationId: string | null;
      orgId: string | null;
      channel: string | null;
      requestId: string | null;
      failedReason: string | null;
      failedAt: string | null;
      attemptsMade: number;
      timestamp: string | null;
    }[];
  };
  recentFailures: {
    ok: boolean;
    count: number;
    error: string | null;
    items: {
      id: string;
      orgId: string;
      orgName: string | null;
      orgSlug: string | null;
      status: string;
      errorMessage: string | null;
      providerMessageId: string | null;
      requestId: string | null;
      createdAt: string;
      sentAt: string | null;
    }[];
  };
  fetchedAt: string;
};

type PlatformHealthMeta = {
  status: string;
  release: string;
  environment: string;
  sentryEnabled: boolean;
  timestamp: string;
};

type PlatformReadiness = {
  status: string;
  dependencies?: { database?: string; redis?: string };
};

type HealthSnapshot = {
  id: string;
  status: string;
  metrics?: {
    avgWaitMinutesCompleted?: number;
    noShowRate?: number;
    subscriptionStatus?: string;
    reasons?: string[];
  } | null;
  computedAt: string;
  organization?: { id: string; name: string; slug: string };
};

const platformApiBase = getApiBase();

export default function InfrastructurePage() {
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ops', 'health-snapshots'],
    queryFn: () =>
      api
        .get<{
          data: { items: HealthSnapshot[]; total: number };
        }>('/platform-admin/health/snapshots', { token: token! })
        .then((r) => r.data),
    enabled: !!token,
    retry: false,
    refetchInterval: 15000,
  });

  const { data: twoFAStatus } = useQuery({
    queryKey: ['platform', '2fa', 'status'],
    queryFn: () =>
      api
        .get<{
          success: boolean;
          data: { enabled: boolean; enrollmentPending: boolean };
        }>('/platform-admin/2fa/status', { token: token! })
        .then((r) => r?.data),
    enabled: !!token,
  });

  const { data: deploymentFeatures } = useQuery({
    queryKey: ['ops', 'deployment', 'features'],
    queryFn: () =>
      api
        .get<{ data: DeploymentFeatures }>('/platform-admin/deployment/features', { token: token! })
        .then((r) => r?.data),
    enabled: !!token,
    staleTime: 60_000,
    retry: false,
  });

  const { data: deploymentStatus } = useQuery({
    queryKey: ['ops', 'deployment', 'status'],
    queryFn: () =>
      api
        .get<{ data: DeploymentStatus }>('/platform-admin/deployment/status', { token: token! })
        .then((r) => r?.data),
    enabled: !!token,
    refetchInterval: 60_000,
    retry: false,
  });

  const { data: smsHealth } = useQuery({
    queryKey: ['ops', 'sms', 'health'],
    queryFn: () =>
      api
        .get<{ data: SmsHealth }>('/platform-admin/sms/health', { token: token! })
        .then((r) => r?.data),
    enabled: !!token,
    refetchInterval: 30_000,
    retry: false,
  });

  const {
    data: smsOps,
    isLoading: smsOpsLoading,
    isError: smsOpsError,
    error: smsOpsQueryError,
  } = useQuery({
    queryKey: ['ops', 'sms', 'ops'],
    queryFn: () =>
      api.get<{ data: SmsOps }>('/platform-admin/sms/ops', { token: token! }).then((r) => r?.data),
    enabled: !!token,
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: platformLive } = useQuery({
    queryKey: ['platform', 'health', 'live'],
    queryFn: async () => {
      const res = await fetch(`${platformApiBase}/health/live`);
      if (!res.ok) throw new Error(`Live health ${res.status}`);
      return res.json() as Promise<{ status: string; timestamp: string }>;
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: platformMeta } = useQuery({
    queryKey: ['platform', 'health', 'meta'],
    queryFn: async () => {
      const res = await fetch(`${platformApiBase}/health/meta`);
      if (!res.ok) throw new Error(`Meta health ${res.status}`);
      return res.json() as Promise<PlatformHealthMeta>;
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  const { data: platformReady } = useQuery({
    queryKey: ['platform', 'health', 'ready'],
    queryFn: async () => {
      const res = await fetch(`${platformApiBase}/health`);
      const body = (await res.json().catch(() => ({}))) as PlatformReadiness;
      if (!res.ok) {
        return { status: 'degraded', dependencies: body.dependencies };
      }
      return body;
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  const { data: notificationsPublic } = useQuery({
    queryKey: ['platform', 'health', 'notifications'],
    queryFn: async () => {
      const res = await fetch(`${platformApiBase}/health/notifications`);
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        worker?: string;
        ageMs?: number;
      };
      return { ok: res.ok, ...body };
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const computeMutation = useMutation({
    mutationFn: () => api.post('/platform-admin/health/compute', {}, { token: token! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ops', 'health-snapshots'] }),
  });

  const items = result?.items ?? [];

  const apiLiveDown = platformLive != null && platformLive.status !== 'ok';
  const apiReadyDown =
    platformReady != null &&
    (platformReady.status === 'degraded' ||
      platformReady.dependencies?.database !== 'ok' ||
      platformReady.dependencies?.redis !== 'ok');
  const smsWorkerDown =
    smsHealth?.notificationsWorker.status === 'down' ||
    (notificationsPublic != null && !notificationsPublic.ok);
  const healthAlerts: string[] = [];
  if (apiLiveDown) healthAlerts.push('API liveness is failing — possible crash-loop or outage.');
  if (apiReadyDown) healthAlerts.push('API readiness degraded (database/redis).');
  if (smsWorkerDown) {
    healthAlerts.push(
      `Notifications worker is down (${smsHealth?.notificationsWorker.reason ?? notificationsPublic?.worker ?? 'check heartbeat'}).`,
    );
  }
  if (smsHealth?.warnings?.length) {
    for (const warning of smsHealth.warnings) {
      if (!healthAlerts.includes(warning)) healthAlerts.push(warning);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Infrastructure Health</h1>
          <p className="mt-1 text-sm text-slate-500">
            Deploy/migrate status, SMS worker, API health, and per-tenant ops snapshots.
          </p>
        </div>
        <button
          onClick={() => computeMutation.mutate()}
          disabled={computeMutation.isPending}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${computeMutation.isPending ? 'animate-spin' : ''}`} />
          {computeMutation.isPending ? 'Recomputing...' : 'Recompute Snapshots'}
        </button>
      </div>

      {healthAlerts.length > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-bold">Production health alert</p>
              {healthAlerts.map((msg) => (
                <p key={msg}>{msg}</p>
              ))}
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                {deploymentStatus?.opsLinks?.sentry ? (
                  <a
                    href={deploymentStatus.opsLinks.sentry}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-red-800 underline"
                  >
                    Open Sentry <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
                {deploymentStatus?.opsLinks?.betterStackUptime ? (
                  <a
                    href={deploymentStatus.opsLinks.betterStackUptime}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-red-800 underline"
                  >
                    Better Stack uptime <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {((twoFAStatus !== undefined && !twoFAStatus.enabled) ||
        (error as any)?.data?.error?.message === 'Two-factor authentication is required') && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100/50">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
            </div>
            <span>High-level infrastructure metrics require active 2FA.</span>
          </div>
          <button
            onClick={() => router.push('/security')}
            className="rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            Secure Access
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Deploy / migration</h2>
              <p className="text-xs text-slate-500">Post-deploy release + Prisma migrate history</p>
            </div>
          </div>
          {deploymentStatus == null ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-slate-500">Release </span>
                <span className="font-mono text-xs font-semibold text-slate-800">
                  {deploymentStatus.release}
                </span>
                <span className="text-slate-400"> · {deploymentStatus.environment}</span>
              </p>
              <p className="text-xs text-slate-600">
                Migrate on start:{' '}
                <strong>{deploymentStatus.runMigrationsOnStart ? 'yes' : 'no (manual/CI)'}</strong>
              </p>
              {deploymentStatus.lastAppliedMigration ? (
                <p className="text-xs text-slate-600">
                  Last applied:{' '}
                  <span className="font-mono font-medium text-slate-800">
                    {deploymentStatus.lastAppliedMigration.name}
                  </span>
                  {deploymentStatus.lastAppliedMigration.finishedAt
                    ? ` · ${new Date(deploymentStatus.lastAppliedMigration.finishedAt).toLocaleString()}`
                    : ''}
                </p>
              ) : (
                <p className="text-xs text-amber-700">No finished migration found.</p>
              )}
              {deploymentStatus.migrationsError ? (
                <p className="text-xs text-red-600">{deploymentStatus.migrationsError}</p>
              ) : null}
              <p className="text-[11px] text-slate-400">{deploymentStatus.note}</p>
              {deploymentStatus.opsLinks ? (
                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs font-semibold">
                  <a
                    href={deploymentStatus.opsLinks.sentry}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    Sentry <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={deploymentStatus.opsLinks.betterStackUptime}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    Better Stack uptime <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={deploymentStatus.opsLinks.betterStackStatus}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                  >
                    Status page <ExternalLink className="h-3 w-3" />
                  </a>
                  {deploymentStatus.opsLinks.betterStackLogs ? (
                    <a
                      href={deploymentStatus.opsLinks.betterStackLogs}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      Better Stack logs <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              ) : null}
              {deploymentStatus.recentMigrations.length > 0 ? (
                <ul className="max-h-40 space-y-1 overflow-y-auto border-t border-slate-100 pt-2 font-mono text-[10px] text-slate-500">
                  {deploymentStatus.recentMigrations.slice(0, 6).map((m) => (
                    <li key={m.name} className="flex justify-between gap-2">
                      <span className="truncate">{m.name}</span>
                      <span className="shrink-0">
                        {m.rolledBackAt
                          ? 'rolled back'
                          : m.finishedAt
                            ? new Date(m.finishedAt).toLocaleDateString()
                            : 'pending'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-xs text-slate-500">
                Public meta:{' '}
                {platformMeta == null
                  ? '…'
                  : `${platformMeta.release.slice(0, 12)} · Sentry ${platformMeta.sentryEnabled ? 'on' : 'off'}`}
              </p>
              {deploymentFeatures ? (
                <p className="text-xs text-slate-500">
                  {deploymentFeatures.visitJourneysGloballyDisabled
                    ? 'Visit journeys globally disabled.'
                    : deploymentFeatures.visitJourneysLegacyGlobalOn
                      ? 'Legacy global visit journeys on.'
                      : 'Visit journeys per-organization.'}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">SMS / Twilio</h2>
              <p className="text-xs text-slate-500">
                DO notifications worker is production-critical
              </p>
            </div>
          </div>
          {smsHealth == null ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    smsHealth.notificationsWorker.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <span className="font-semibold text-slate-800">
                  Notifications worker:{' '}
                  {smsHealth.notificationsWorker.status === 'ok' ? 'ok' : 'down'}
                </span>
                {smsHealth.notificationsWorker.reason ? (
                  <span className="text-xs text-red-600">
                    ({smsHealth.notificationsWorker.reason})
                  </span>
                ) : null}
                {smsHealth.notificationsWorker.ageMs != null ? (
                  <span className="text-xs text-slate-400">
                    heartbeat {Math.round(smsHealth.notificationsWorker.ageMs / 1000)}s ago
                  </span>
                ) : null}
              </div>
              {notificationsPublic && !notificationsPublic.ok ? (
                <p className="text-xs text-red-600">
                  Public /health/notifications also failing (
                  {notificationsPublic.worker ?? notificationsPublic.status}).
                </p>
              ) : null}
              {smsHealth.twilioBalance ? (
                <p
                  className={`text-xs font-medium ${
                    smsHealth.twilioBalance.level === 'critical'
                      ? 'text-red-700'
                      : smsHealth.twilioBalance.level === 'warn'
                        ? 'text-amber-700'
                        : smsHealth.twilioBalance.level === 'unknown'
                          ? 'text-slate-500'
                          : 'text-emerald-700'
                  }`}
                >
                  Twilio balance:{' '}
                  {smsHealth.twilioBalance.balanceUsd != null
                    ? `$${smsHealth.twilioBalance.balanceUsd.toFixed(2)} ${smsHealth.twilioBalance.currency ?? 'USD'}`
                    : (smsHealth.twilioBalance.error ?? 'unknown')}{' '}
                  ({smsHealth.twilioBalance.level})
                </p>
              ) : null}
              {smsHealth.smsPackPrices && !smsHealth.smsPackPrices.allConfigured ? (
                <p className="text-xs text-amber-700">
                  SMS pack Stripe prices missing env:{' '}
                  {smsHealth.smsPackPrices.missingEnvKeys.join(', ')}
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-lg font-bold tabular-nums text-slate-900">
                    {smsHealth.sends24h.success}
                  </p>
                  <p className="text-[10px] uppercase text-slate-400">OK 24h</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      smsHealth.sends24h.failed > 0 ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {smsHealth.sends24h.failed}
                  </p>
                  <p className="text-[10px] uppercase text-slate-400">Fail 24h</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-lg font-bold tabular-nums text-slate-900">
                    {smsHealth.sends24h.pending}
                  </p>
                  <p className="text-[10px] uppercase text-slate-400">Pending</p>
                </div>
              </div>
              <ul className="space-y-1 text-xs text-slate-600">
                <li>
                  Account SID:{' '}
                  {smsHealth.twilio.accountSidConfigured
                    ? smsHealth.twilio.accountSidMasked
                    : 'missing'}
                </li>
                <li>
                  Messaging Service:{' '}
                  {smsHealth.twilio.messagingServiceSidConfigured
                    ? smsHealth.twilio.messagingServiceSidMasked
                    : 'not set (using From number)'}
                </li>
                <li>
                  Auth:{' '}
                  {smsHealth.twilio.authTokenConfigured || smsHealth.twilio.apiKeyConfigured
                    ? 'configured'
                    : 'missing'}{' '}
                  · Status callback: {smsHealth.twilio.statusCallbackConfigured ? 'on' : 'off'}
                </li>
              </ul>
              <p className="text-[11px] text-slate-400">{smsHealth.twilio.a2pNote}</p>
              {smsHealth.topTenants.length > 0 ? (
                <div className="border-t border-slate-100 pt-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Top tenants (24h sends)
                  </p>
                  <ul className="space-y-1 text-xs">
                    {smsHealth.topTenants.map((t) => (
                      <li key={t.orgId} className="flex justify-between gap-2">
                        <Link
                          href={`/tenants/${t.orgId}`}
                          className="truncate font-medium text-indigo-600 hover:underline"
                        >
                          {t.name}
                        </Link>
                        <span className="shrink-0 tabular-nums text-slate-500">
                          {t.sends24h} · {t.used}/{t.allowance.effectiveLimit} credits
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Queues / SMS failures</h2>
            <p className="text-xs text-slate-500">
              BullMQ depth, notifications-dead, and recent Twilio/SMS failures
            </p>
          </div>
          {smsOps?.fetchedAt ? (
            <span className="text-[10px] text-slate-400">
              Updated {new Date(smsOps.fetchedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
        {smsOpsLoading && !smsOps ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : smsOpsError ? (
          <p className="text-sm text-red-600">
            Failed to load queue diagnostics
            {smsOpsQueryError instanceof Error && smsOpsQueryError.message
              ? `: ${smsOpsQueryError.message}`
              : '.'}
          </p>
        ) : smsOps == null ? (
          <p className="text-sm text-slate-400">No queue diagnostics available.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(
                [
                  ['notifications', smsOps.queues.notifications],
                  ['notifications-dead', smsOps.queues.notificationsDead],
                  ['scheduled-jobs', smsOps.queues.scheduledJobs],
                ] as const
              ).map(([label, q]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">{label}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${q.ok ? 'bg-emerald-500' : 'bg-red-500'}`}
                    />
                  </div>
                  <p className="tabular-nums text-slate-700">
                    depth <span className="font-bold">{q.depth}</span> · wait {q.counts.waiting} ·
                    active {q.counts.active} · delayed {q.counts.delayed}
                  </p>
                  <p className="tabular-nums text-slate-500">
                    failed {q.counts.failed} · completed {q.counts.completed}
                  </p>
                  {q.error ? <p className="mt-1 text-red-600">{q.error}</p> : null}
                  {q.lastErrors[0]?.failedReason ? (
                    <p className="mt-2 line-clamp-2 text-[11px] text-amber-800">
                      Last error: {q.lastErrors[0].failedReason}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Dead letter (total {smsOps.deadLetter.count}
                  {smsOps.deadLetter.jobs.length > 0 &&
                  smsOps.deadLetter.jobs.length < smsOps.deadLetter.count
                    ? `, showing ${smsOps.deadLetter.jobs.length}`
                    : ''}
                  )
                </p>
                {smsOps.deadLetter.error ? (
                  <p className="text-xs text-red-600">{smsOps.deadLetter.error}</p>
                ) : smsOps.deadLetter.jobs.length === 0 ? (
                  <p className="text-xs text-slate-400">No dead-letter jobs.</p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
                    {smsOps.deadLetter.jobs.map((job) => (
                      <li
                        key={job.id ?? `${job.notificationId}-${job.failedAt}`}
                        className="rounded-lg border border-slate-100 p-2"
                      >
                        <div className="flex justify-between gap-2 font-medium text-slate-800">
                          <span className="truncate">
                            {job.channel ?? '?'} · {job.notificationId?.slice(0, 8) ?? 'no-id'}…
                          </span>
                          <span className="shrink-0 text-slate-400">
                            {job.failedAt
                              ? new Date(job.failedAt).toLocaleString()
                              : job.timestamp
                                ? new Date(job.timestamp).toLocaleString()
                                : '—'}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-red-700">
                          {job.failedReason ?? 'Unknown failure'}
                        </p>
                        {job.requestId ? (
                          <p className="mt-1 font-mono text-[10px] text-slate-500">
                            ref {job.requestId.slice(0, 8)}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Recent SMS failures ({smsOps.recentFailures.count})
                </p>
                {smsOps.recentFailures.error ? (
                  <p className="text-xs text-red-600">{smsOps.recentFailures.error}</p>
                ) : smsOps.recentFailures.items.length === 0 ? (
                  <p className="text-xs text-slate-400">No failed SMS rows.</p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
                    {smsOps.recentFailures.items.map((item) => (
                      <li key={item.id} className="rounded-lg border border-slate-100 p-2">
                        <div className="flex justify-between gap-2">
                          {item.orgId ? (
                            <Link
                              href={`/tenants/${item.orgId}`}
                              className="truncate font-medium text-indigo-600 hover:underline"
                            >
                              {item.orgName ?? item.orgSlug ?? item.orgId.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-800">Unknown org</span>
                          )}
                          <span className="shrink-0 text-slate-400">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-red-700">
                          {item.errorMessage ?? 'Failed (no Twilio error text)'}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-slate-500">
                          {item.providerMessageId
                            ? `SID ${item.providerMessageId.slice(0, 10)}…`
                            : 'no SID'}
                          {item.requestId ? ` · ref ${item.requestId.slice(0, 8)}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
              <Radio className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold tracking-tight text-slate-900">API liveness</h3>
              <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
                {platformApiBase}/health/live
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    platformLive?.status === 'ok' ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'
                  }`}
                />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  {platformLive?.status === 'ok' ? 'Reachable' : 'Checking…'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold tracking-tight text-slate-900">Core Database</h3>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    platformReady?.dependencies?.database === 'ok'
                      ? 'bg-emerald-500'
                      : 'animate-pulse bg-amber-500'
                  }`}
                />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  {platformReady?.dependencies?.database === 'ok'
                    ? 'Connected'
                    : 'Unknown / degraded'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold tracking-tight text-slate-900">Redis</h3>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    platformReady?.dependencies?.redis === 'ok'
                      ? 'bg-emerald-500'
                      : 'animate-pulse bg-amber-500'
                  }`}
                />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  {platformReady?.dependencies?.redis === 'ok' ? 'Connected' : 'Unknown / degraded'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-bold text-slate-900">Tenant health snapshots</h2>
          <p className="text-xs text-slate-500">
            Wait / no-show / subscription signals (7d window). Recompute after incidents.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Organization
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Avg wait
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  No-show
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sub
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Last Check
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                      <div className="h-4 w-full rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Server className="mb-3 h-10 w-10 text-slate-200" />
                      <p className="text-sm italic text-slate-400">No snapshots available.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((snap) => {
                  const status = snap.status ?? 'unknown';
                  const metrics = snap.metrics ?? {};
                  return (
                    <tr key={snap.id} className="group transition-colors hover:bg-slate-50/50">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <Link
                            href={snap.organization?.id ? `/tenants/${snap.organization.id}` : '#'}
                            className="font-semibold text-slate-900 transition-colors group-hover:text-indigo-600"
                          >
                            {snap.organization?.name}
                          </Link>
                          <span className="font-mono text-[10px] tracking-tighter text-slate-400">
                            SLUG: {snap.organization?.slug}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            status === 'healthy'
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                              : status === 'degraded'
                                ? 'border-amber-100 bg-amber-50 text-amber-700'
                                : 'border-red-100 bg-red-50 text-red-700'
                          }`}
                        >
                          <span
                            className={`h-1 w-1 rounded-full ${
                              status === 'healthy'
                                ? 'bg-emerald-500'
                                : status === 'degraded'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                          />
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-medium tabular-nums text-slate-600">
                          {metrics.avgWaitMinutesCompleted != null
                            ? `${metrics.avgWaitMinutesCompleted}m`
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-medium tabular-nums text-slate-600">
                          {metrics.noShowRate != null
                            ? `${Math.round(metrics.noShowRate * 100)}%`
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs capitalize text-slate-600">
                          {metrics.subscriptionStatus ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-[10px] font-medium text-slate-400">
                          {new Date(snap.computedAt).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
