'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, MessageSquare, Search } from 'lucide-react';
import { Suspense, useState, useEffect } from 'react';
import { formatSlaCountdown } from '@/lib/support-ops';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-slate-100 text-slate-600',
  high: 'bg-red-100 text-red-700',
  urgent: 'bg-red-200 text-red-800 font-bold',
};

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-500">Loading support queue…</div>
      }
    >
      <SupportPageContent />
    </Suspense>
  );
}

function SupportPageContent() {
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId') ?? '';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ops', 'support-requests', debouncedSearch, statusFilter, orgId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (orgId) params.append('orgId', orgId);
      return api
        .get<any>(`/platform-admin/support/requests?${params.toString()}`, { token: token! })
        .then((r) => r?.data);
    },
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

  const items = Array.isArray(result) ? result : (result?.items ?? []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support Queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cross-tenant tickets with SLA timers — click a row to reply or assign.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Click a row to view and respond</span>
        </div>
      </div>

      <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by ticket ID, subject, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm placeholder-slate-400 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-[38px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-auto"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        {orgId ? (
          <button
            type="button"
            onClick={() => {
              router.replace('/support');
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear org filter
          </button>
        ) : null}
      </div>

      {((twoFAStatus !== undefined && !twoFAStatus.enabled) ||
        (error as any)?.data?.error?.code === 'TWO_FACTOR_REQUIRED') && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <span>Two-factor authentication is required to manage support tickets.</span>
          <button
            onClick={() => router.push('/security')}
            className="ml-4 rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Set up authenticator
          </button>
        </div>
      )}

      {error &&
        (error as any)?.data?.error?.message !== 'Two-factor authentication is required' && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-900">
            <h3 className="font-semibold text-red-800">Error loading support tickets</h3>
            <p className="mt-1 text-sm">
              {error instanceof Error ? error.message : 'An unknown error occurred.'}
            </p>
          </div>
        )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-6 p-6">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                </div>
                <div className="h-6 w-20 rounded-full bg-slate-100" />
                <div className="h-6 w-16 rounded-full bg-slate-100" />
                <div className="h-4 w-32 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
              <MessageSquare className="h-8 w-8 text-indigo-300" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">All clear!</h3>
            <p className="mt-1 text-xs text-slate-500">No pending support tickets at the moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Ticket
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    SLA
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Assignee
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Organization
                  </th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((req: any) => {
                  const statusStyle = STATUS_STYLES[req.status] ?? 'bg-slate-100 text-slate-600';
                  const priorityStyle =
                    PRIORITY_STYLES[req.priority] ?? 'bg-slate-100 text-slate-600';
                  const user = req.user ?? req.createdBy;
                  const hasUnread = req.hasUnreadTenantReply;
                  const sla = formatSlaCountdown(req.status === 'resolved' ? null : req.dueAt);

                  return (
                    <tr
                      key={req.id}
                      onClick={() => router.push(`/support/${req.id}`)}
                      className="group cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-6 py-5">
                        <div className="flex min-w-0 items-center gap-3">
                          {hasUnread && (
                            <div
                              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-indigo-600"
                              title="Unread reply"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="max-w-md truncate font-semibold text-slate-900 transition-colors group-hover:text-indigo-700">
                              {req.subject}
                            </p>
                            {user && (
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                {user.firstName} {user.lastName} ·{' '}
                                <span className="text-slate-400">{user.email}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyle} border-current/10`}
                        >
                          <span className="h-1 w-1 rounded-full bg-current" />
                          {req.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${priorityStyle} border-current/10`}
                        >
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            sla.overdue ? 'text-red-600' : 'text-slate-600',
                          )}
                        >
                          {sla.label}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs text-slate-600">
                          {req.assignedTo
                            ? `${req.assignedTo.firstName ?? ''} ${req.assignedTo.lastName ?? ''}`.trim() ||
                              req.assignedTo.email
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {req.organization?.id ? (
                          <Link
                            href={`/tenants/${req.organization.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex flex-col hover:underline"
                          >
                            <span className="max-w-[120px] truncate text-xs font-semibold text-indigo-700">
                              {req.organization?.name ?? '—'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              #{req.organization?.slug}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700">
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
