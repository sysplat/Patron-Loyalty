'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

type AuditEvent = {
  id: string;
  createdAt: string;
  eventType: string;
  severity: string;
  actorEmail: string | null;
  actorUserId: string | null;
  subjectOrgId: string | null;
  metadata: unknown;
};

export default function AuditPage() {
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();

  const [eventType, setEventType] = useState('');
  const [subjectOrgId, setSubjectOrgId] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [severity, setSeverity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({
    eventType: '',
    subjectOrgId: '',
    actorEmail: '',
    severity: '',
    from: '',
    to: '',
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('take', '100');
    if (applied.eventType) params.set('eventType', applied.eventType);
    if (applied.subjectOrgId) params.set('subjectOrgId', applied.subjectOrgId);
    if (applied.actorEmail) params.set('actorEmail', applied.actorEmail);
    if (applied.severity) params.set('severity', applied.severity);
    if (applied.from) params.set('from', new Date(applied.from).toISOString());
    if (applied.to) {
      const end = new Date(applied.to);
      end.setHours(23, 59, 59, 999);
      params.set('to', end.toISOString());
    }
    return params.toString();
  }, [applied]);

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ops', 'audit-events', queryParams],
    queryFn: () =>
      api
        .get<{
          data: { items: AuditEvent[]; total: number };
        }>(`/platform-admin/audit/events?${queryParams}`, { token: token! })
        .then((r) => r.data),
    enabled: !!token,
    retry: false,
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

  const items = result?.items ?? [];
  const total = result?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
          <p className="mt-1 text-sm text-slate-500">
            Immutable log of sensitive operations. For login/reset/2FA history: filter Event type{' '}
            <code className="rounded bg-slate-100 px-1">auth.*</code> and Actor email.
          </p>
        </div>
      </div>

      {(!twoFAStatus?.enabled ||
        (error as any)?.data?.error?.message === 'Two-factor authentication is required') && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100/50">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
            </div>
            <span>Security clearance required to view audit logs.</span>
          </div>
          <button
            onClick={() => router.push('/security')}
            className="rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
          >
            Enable 2FA
          </button>
        </div>
      )}

      <form
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({
            eventType: eventType.trim(),
            subjectOrgId: subjectOrgId.trim(),
            actorEmail: actorEmail.trim(),
            severity: severity.trim(),
            from,
            to,
          });
        }}
      >
        <label className="block text-xs font-medium text-slate-600">
          Event type
          <input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="exact or auth.*"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Org ID
          <input
            value={subjectOrgId}
            onChange={(e) => setSubjectOrgId(e.target.value)}
            placeholder="uuid"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Actor email
          <input
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
            placeholder="email prefix or full"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-2 md:col-span-3 lg:col-span-6">
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              setEventType('auth.*');
              setApplied({
                eventType: 'auth.*',
                subjectOrgId: subjectOrgId.trim(),
                actorEmail: actorEmail.trim(),
                severity: severity.trim(),
                from,
                to,
              });
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Auth attempts
          </button>
          <button
            type="button"
            onClick={() => {
              setEventType('');
              setSubjectOrgId('');
              setActorEmail('');
              setSeverity('');
              setFrom('');
              setTo('');
              setApplied({
                eventType: '',
                subjectOrgId: '',
                actorEmail: '',
                severity: '',
                from: '',
                to: '',
              });
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
          <span className="ml-auto self-center text-xs text-slate-500">
            {total.toLocaleString()} matching
          </span>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Timestamp
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Event
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Severity
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Actor
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Target Org
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Metadata
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-6">
                      <div className="h-4 w-full rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm italic text-slate-400">
                    No audit events match these filters.
                  </td>
                </tr>
              ) : (
                items.map((event) => (
                  <tr key={event.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-900">
                          {new Date(event.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold tracking-tight text-slate-700">
                        {event.eventType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          event.severity === 'critical'
                            ? 'border-red-100 bg-red-50 text-red-700'
                            : event.severity === 'warning'
                              ? 'border-amber-100 bg-amber-50 text-amber-700'
                              : event.severity === 'info'
                                ? 'border-blue-100 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${
                            event.severity === 'critical'
                              ? 'bg-red-500'
                              : event.severity === 'warning'
                                ? 'bg-amber-500'
                                : event.severity === 'info'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-400'
                          }`}
                        />
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="max-w-[150px] truncate text-xs font-medium text-slate-700">
                          {event.actorEmail || 'System'}
                        </span>
                        <span className="font-mono text-[9px] tracking-tighter text-slate-400">
                          ID: {event.actorUserId?.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {event.subjectOrgId ? (
                        <Link
                          href={`/tenants/${event.subjectOrgId}`}
                          className="font-mono text-xs text-indigo-600 hover:underline"
                        >
                          {event.subjectOrgId.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="group relative max-w-[200px] cursor-help">
                        <div className="truncate font-mono text-[10px] text-slate-400">
                          {event.metadata ? JSON.stringify(event.metadata) : '—'}
                        </div>
                        <div className="invisible absolute bottom-full left-0 z-10 mb-2 w-64 break-all rounded-lg bg-slate-900 p-3 text-[10px] leading-relaxed text-white opacity-95 shadow-xl transition-opacity group-hover:visible">
                          {event.metadata ? JSON.stringify(event.metadata, null, 2) : 'No metadata'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
