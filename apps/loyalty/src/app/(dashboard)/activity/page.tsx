'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LOYALTY_ACTIVITY_RESOURCE_TYPES, loyaltyActivityActionLabel } from '@queueplatform/shared';
import { unwrapApiData } from '@/lib/api-response';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatUserDisplayName, isOwnerOrAdmin } from '@/lib/rbac-ui';
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  PageShell,
  PermissionGate,
} from '@/components/dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollText } from 'lucide-react';

type ResourceFilter =
  | 'all'
  | typeof LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_ACCOUNT
  | typeof LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_WALLET
  | typeof LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_GIFT_CARD
  | typeof LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_PROGRAM
  | typeof LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REWARD
  | typeof LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_CAMPAIGN
  | typeof LOYALTY_ACTIVITY_RESOURCE_TYPES.CUSTOMER;

type ActivityUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

type ActivityItem = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: ActivityUser | null;
};

type ActivityListData = {
  items: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const RESOURCE_TABS: { id: ResourceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_ACCOUNT, label: 'Points' },
  { id: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_WALLET, label: 'Wallet' },
  { id: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_GIFT_CARD, label: 'Gift cards' },
  { id: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_PROGRAM, label: 'Program' },
  { id: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REWARD, label: 'Rewards' },
  { id: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_CAMPAIGN, label: 'Campaigns' },
  { id: LOYALTY_ACTIVITY_RESOURCE_TYPES.CUSTOMER, label: 'Patrons' },
];

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return rtf.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return new Date(iso).toLocaleString();
}

function actorLabel(user: ActivityUser | null): string {
  if (!user) return 'System';
  const name = formatUserDisplayName(user);
  return name || user.email || 'Staff';
}

function metadataSummary(meta: Record<string, unknown> | null): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const parts: string[] = [];
  if (typeof meta.points === 'number') parts.push(`${meta.points} pts`);
  if (typeof meta.amountCents === 'number') parts.push(`$${(meta.amountCents / 100).toFixed(2)}`);
  if (typeof meta.deltaCents === 'number') {
    const sign = meta.deltaCents > 0 ? '+' : '';
    parts.push(`${sign}$${(meta.deltaCents / 100).toFixed(2)}`);
  }
  if (typeof meta.created === 'number' || typeof meta.updated === 'number') {
    parts.push(
      `${Number(meta.created ?? 0)} created · ${Number(meta.updated ?? 0)} updated · ${Number(meta.errors ?? 0)} errors`,
    );
  }
  if (typeof meta.code === 'string') parts.push(meta.code);
  if (typeof meta.name === 'string') parts.push(meta.name);
  if (typeof meta.description === 'string' && meta.description) parts.push(meta.description);
  if (typeof meta.filename === 'string' && meta.filename) parts.push(meta.filename);
  if (Array.isArray(meta.changedKeys) && meta.changedKeys.length > 0) {
    parts.push(`changed: ${meta.changedKeys.join(', ')}`);
  }
  if (Array.isArray(meta.changedFields) && meta.changedFields.length > 0) {
    parts.push(`fields: ${meta.changedFields.join(', ')}`);
  }
  if (typeof meta.keyPrefix === 'string') parts.push(`prefix ${meta.keyPrefix}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function resourceHref(item: ActivityItem): string | null {
  const meta = item.metadata ?? {};
  const customerId =
    (typeof meta.customerId === 'string' && meta.customerId) ||
    (item.resourceType === LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_ACCOUNT ||
    item.resourceType === LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_WALLET ||
    item.resourceType === LOYALTY_ACTIVITY_RESOURCE_TYPES.CUSTOMER
      ? item.resourceId
      : null);
  if (customerId) return `/patrons/${customerId}`;
  if (item.resourceType === LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_CAMPAIGN) return '/campaigns';
  if (item.resourceType === LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REWARD) return '/rewards';
  if (item.resourceType === LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_PROGRAM) return '/program';
  if (item.resourceType === LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_GIFT_CARD) return '/wallet';
  return null;
}

export default function ActivityPage() {
  const token = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);
  const allowed = isOwnerOrAdmin(role);

  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('all');
  const [actionQuery, setActionQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '25');
    if (resourceFilter !== 'all') q.set('resourceType', resourceFilter);
    if (actionQuery.trim()) q.set('action', actionQuery.trim());
    // Date-only inputs: interpret in local timezone (avoid UTC midnight shift).
    if (from) q.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) q.set('to', new Date(`${to}T23:59:59.999`).toISOString());
    return q.toString();
  }, [page, resourceFilter, actionQuery, from, to]);

  const activityQuery = useQuery({
    queryKey: ['org-activity-logs', token, queryString],
    enabled: Boolean(token) && allowed,
    queryFn: async () => {
      const payload = await api.get(`/organization/activity-logs?${queryString}`, {
        token: token!,
      });
      return unwrapApiData<ActivityListData>(payload);
    },
  });

  if (!allowed) {
    return (
      <PageShell>
        <PageHeader
          title="Activity"
          subtitle="Owner or admin access is required to review staff activity."
        />
        <PermissionGate message="Ask an owner or admin to open Setup → Activity if you need this trail." />
      </PageShell>
    );
  }

  const data = activityQuery.data;
  const items = data?.items ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Activity"
        subtitle="Who changed points, wallets, program settings, and patron imports — for your organization."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void activityQuery.refetch()}
          >
            Refresh
          </Button>
        }
      />

      <FilterTabs
        tabs={RESOURCE_TABS}
        value={resourceFilter}
        onChange={(id) => {
          setResourceFilter(id);
          setPage(1);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="activity-action">Action contains</Label>
          <Input
            id="activity-action"
            placeholder="e.g. points.adjusted"
            value={actionQuery}
            onChange={(e) => {
              setActionQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-from">From</Label>
          <Input
            id="activity-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-to">To</Label>
          <Input
            id="activity-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {activityQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : activityQuery.isError ? (
        <EmptyState
          icon={ScrollText}
          title="Couldn’t load activity"
          description="Refresh and try again. If this keeps happening, check that your session is still valid."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void activityQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity yet"
          description="Staff adjustments, gift cards, program edits, and CSV imports will show up here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <ul className="divide-y">
            {items.map((item) => {
              const href = resourceHref(item);
              const summary = metadataSummary(item.metadata);
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{loyaltyActivityActionLabel(item.action)}</span>
                      <Badge variant="secondary" className="font-normal">
                        {item.resourceType}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {actorLabel(item.user)}
                      {item.user?.email ? (
                        <span className="text-muted-foreground/80"> · {item.user.email}</span>
                      ) : null}
                    </p>
                    {summary ? <p className="text-muted-foreground text-sm">{summary}</p> : null}
                    {href ? (
                      <Link
                        href={href}
                        className="text-primary text-sm underline-offset-2 hover:underline"
                      >
                        Open related
                      </Link>
                    ) : null}
                  </div>
                  <time
                    className="text-muted-foreground shrink-0 text-xs sm:pt-1"
                    dateTime={item.createdAt}
                    title={new Date(item.createdAt).toLocaleString()}
                  >
                    {relativeTime(item.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Page {data.page} of {data.totalPages} · {data.total} events
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
