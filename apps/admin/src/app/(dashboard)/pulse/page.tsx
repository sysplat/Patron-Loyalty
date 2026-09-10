'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useTabVisible } from '@/lib/use-tab-visible';
import {
  Activity,
  Building2,
  Ticket,
  Users,
  RefreshCw,
  MessageSquare,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DayPoint = { day: string; count: number };

type PulseData = {
  generatedAt: string;
  utcDayStart: string;
  ticketsCreatedToday: number;
  waitingCustomersPlatformWide: number;
  activeServingAgents: number;
  organizationCount: number;
  mrrProxy: number;
  trends: {
    days: number;
    from: string;
    to: string;
    signups: DayPoint[];
    tickets: DayPoint[];
    sms: DayPoint[];
    totals: { signups: number; tickets: number; sms: number };
  };
};

function MiniBars({ series, color }: { series: DayPoint[]; color: string }) {
  const max = Math.max(1, ...series.map((p) => p.count));
  return (
    <div className="mt-4 flex h-16 items-end gap-0.5">
      {series.map((p) => (
        <div
          key={p.day}
          title={`${p.day}: ${p.count}`}
          className={cn('min-w-0 flex-1 rounded-t', color)}
          style={{ height: `${Math.max(4, Math.round((p.count / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

export default function PulsePage() {
  const token = useAuthStore((s) => s.accessToken);
  const tabVisible = useTabVisible();
  const [days, setDays] = useState<7 | 14 | 30>(7);

  const {
    data: pulse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['ops', 'pulse', days],
    queryFn: () =>
      api
        .get<{ data: PulseData }>(`/platform-admin/pulse?days=${days}`, { token: token! })
        .then((r) => r?.data),
    enabled: !!token,
    staleTime: 10_000,
    refetchInterval: tabVisible ? 15000 : false,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Pulse</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live snapshot plus {days}-day trends across signups, tickets, SMS, and MRR proxy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  'rounded-lg px-3 py-1.5 transition-colors',
                  days === d ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">
            {isFetching
              ? 'Syncing...'
              : pulse
                ? `Updated ${new Date(pulse.generatedAt).toLocaleTimeString()}`
                : ''}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: 'Organizations',
            value: pulse?.organizationCount,
            icon: Building2,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
            trend: 'Platform total',
          },
          {
            label: 'Waiting now',
            value: pulse?.waitingCustomersPlatformWide,
            icon: Users,
            color: 'text-amber-600 bg-amber-50 border-amber-100',
            trend: 'Live',
          },
          {
            label: 'Serving agents',
            value: pulse?.activeServingAgents,
            icon: Activity,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
            trend: 'Live',
          },
          {
            label: 'Tickets today',
            value: pulse?.ticketsCreatedToday,
            icon: Ticket,
            color: 'text-blue-600 bg-blue-50 border-blue-100',
            trend: 'UTC day',
          },
          {
            label: 'MRR proxy',
            value:
              pulse?.mrrProxy != null
                ? `$${pulse.mrrProxy.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : undefined,
            icon: DollarSign,
            color: 'text-violet-600 bg-violet-50 border-violet-100',
            trend: 'Active/trialing',
            raw: false,
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border ${stat.color}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {stat.trend}
                </span>
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {stat.label}
              </h3>
              <div className="mt-1">
                {isLoading ? (
                  <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
                ) : (
                  <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                    {typeof stat.value === 'string'
                      ? stat.value
                      : (stat.value?.toLocaleString() ?? 0)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          {
            title: 'Signups',
            total: pulse?.trends.totals.signups,
            series: pulse?.trends.signups ?? [],
            color: 'bg-indigo-400',
            icon: Building2,
          },
          {
            title: 'Tickets',
            total: pulse?.trends.totals.tickets,
            series: pulse?.trends.tickets ?? [],
            color: 'bg-blue-400',
            icon: Ticket,
          },
          {
            title: 'SMS sends',
            total: pulse?.trends.totals.sms,
            series: pulse?.trends.sms ?? [],
            color: 'bg-emerald-400',
            icon: MessageSquare,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900">{card.title}</h3>
                </div>
                <span className="text-xs font-medium text-slate-500">Last {days}d</span>
              </div>
              {isLoading ? (
                <div className="mt-4 h-16 animate-pulse rounded bg-slate-100" />
              ) : (
                <>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                    {(card.total ?? 0).toLocaleString()}
                  </p>
                  <MiniBars series={card.series} color={card.color} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
