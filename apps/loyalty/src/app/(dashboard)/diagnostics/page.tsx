'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { isOwnerOrAdmin } from '@/lib/rbac-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DiagnosticsSummary = {
  windowHours: number;
  notifications: { pending: number; sent: number; delivered: number; failed: number };
  campaigns: {
    queued: number;
    sending: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  stuckRedemptions: number;
  recentFailedNotifications: Array<{
    id: string;
    channel: string;
    status: string;
    error?: string;
    at: string;
    requestId?: string;
    providerMessageId?: string;
  }>;
  connector: {
    clientErrorCount4xx: number | null;
    lastIngest: {
      at: string;
      route: string;
      outcome: string;
      event?: string;
      requestId?: string;
    } | null;
  };
  health: { api: string; database: string; redis: string };
  release?: string;
};

type TimelineItem = {
  id: string;
  kind: string;
  at: string;
  status?: string;
  channel?: string;
  title: string;
  requestId?: string;
  providerMessageId?: string;
  campaignId?: string;
  campaignSendId?: string;
  notificationId?: string;
  sourceType?: string;
  sourceId?: string;
  error?: string;
};

type IntegrationEvent = {
  id: string;
  at: string;
  route: string;
  event?: string;
  sourceId?: string;
  outcome: string;
  httpStatus?: number;
  durationMs?: number;
  requestId?: string;
  idempotencyKey?: string;
  redactedPayload?: unknown;
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === 'ok' || value === 'delivered' || value === 'sent'
      ? 'default'
      : value === 'failed' || value === 'error' || value === 'degraded'
        ? 'destructive'
        : 'secondary';
  return <Badge variant={tone as 'default' | 'secondary' | 'destructive'}>{value}</Badge>;
}

export default function DiagnosticsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);
  const allowed = isOwnerOrAdmin(role);

  const [customerId, setCustomerId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [timelineEnabled, setTimelineEnabled] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ['loyalty-diagnostics-summary', token],
    enabled: Boolean(token) && allowed,
    queryFn: () => loyaltyGet<DiagnosticsSummary>('/loyalty/diagnostics/summary', token!),
  });

  const eventsQuery = useQuery({
    queryKey: ['loyalty-diagnostics-events', token],
    enabled: Boolean(token) && allowed,
    queryFn: () =>
      loyaltyGet<{ items: IntegrationEvent[] }>(
        '/loyalty/diagnostics/integration-events?limit=40',
        token!,
      ),
  });

  const timelineParams = useMemo(() => {
    const q = new URLSearchParams();
    if (customerId.trim()) q.set('customerId', customerId.trim());
    if (campaignId.trim()) q.set('campaignId', campaignId.trim());
    if (requestId.trim()) q.set('requestId', requestId.trim());
    q.set('limit', '60');
    return q.toString();
  }, [customerId, campaignId, requestId]);

  const hasTimelineFilter = Boolean(customerId.trim() || campaignId.trim() || requestId.trim());

  const timelineQuery = useQuery({
    queryKey: ['loyalty-diagnostics-timeline', token, timelineParams],
    enabled: Boolean(token) && allowed && timelineEnabled && hasTimelineFilter,
    queryFn: () =>
      loyaltyGet<{ items: TimelineItem[] }>(
        `/loyalty/diagnostics/delivery-timeline?${timelineParams}`,
        token!,
      ),
  });

  if (!allowed) {
    return (
      <div className="space-y-4 p-6">
        <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Diagnostics</h1>
        <p className="text-muted-foreground text-sm">
          Owner or admin access is required for tenant diagnostics.
        </p>
      </div>
    );
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Diagnostics</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Find where OTP, earn, redeem, campaigns, and connector traffic stopped — without
            Railway.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void summaryQuery.refetch();
            void eventsQuery.refetch();
            if (timelineEnabled) void timelineQuery.refetch();
          }}
        >
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">API health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Overall</span>
              <StatusPill value={summary?.health.api ?? '…'} />
            </div>
            <div className="flex items-center justify-between">
              <span>Database</span>
              <StatusPill value={summary?.health.database ?? '…'} />
            </div>
            <div className="flex items-center justify-between">
              <span>Redis</span>
              <StatusPill value={summary?.health.redis ?? '…'} />
            </div>
            {summary?.release ? (
              <p className="text-muted-foreground truncate text-xs">Release {summary.release}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notifications (24h)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div>Pending: {summary?.notifications.pending ?? '—'}</div>
            <div>Sent: {summary?.notifications.sent ?? '—'}</div>
            <div>Delivered: {summary?.notifications.delivered ?? '—'}</div>
            <div>Failed: {summary?.notifications.failed ?? '—'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Campaigns (24h)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div>Queued: {summary?.campaigns.queued ?? '—'}</div>
            <div>Sending: {summary?.campaigns.sending ?? '—'}</div>
            <div>Sent: {summary?.campaigns.sent ?? '—'}</div>
            <div>Failed: {summary?.campaigns.failed ?? '—'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connector</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              Stuck redemptions (&gt;24h pending):{' '}
              <strong>{summary?.stuckRedemptions ?? '—'}</strong>
            </div>
            <div>
              4xx (1h window):{' '}
              <strong>
                {summary?.connector.clientErrorCount4xx == null
                  ? 'n/a'
                  : summary.connector.clientErrorCount4xx}
              </strong>
            </div>
            {summary?.connector.lastIngest ? (
              <p className="text-muted-foreground text-xs">
                Last ingest {formatWhen(summary.connector.lastIngest.at)} ·{' '}
                {summary.connector.lastIngest.route} · {summary.connector.lastIngest.outcome}
                {summary.connector.lastIngest.requestId
                  ? ` · ${summary.connector.lastIngest.requestId.slice(0, 8)}`
                  : ''}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">No ingest events recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent failed SMS / email</CardTitle>
          <CardDescription>Last failures in the summary window with request ids.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(summary?.recentFailedNotifications.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">No recent failures.</p>
          ) : (
            summary!.recentFailedNotifications.map((row) => (
              <div
                key={row.id}
                className="border-border/60 flex flex-col gap-1 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">
                    {row.channel} · {row.status}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {formatWhen(row.at)}
                    {row.error ? ` · ${row.error}` : ''}
                  </div>
                </div>
                <div className="text-muted-foreground font-mono text-xs">
                  {row.requestId ? `req ${row.requestId}` : 'no requestId'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery timeline</CardTitle>
          <CardDescription>
            OTP → earn → redeem → campaign → Twilio/SendGrid provider status for one patron or
            campaign.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="diag-customer">Customer ID</Label>
              <Input
                id="diag-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="UUID from patrons"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diag-campaign">Campaign ID</Label>
              <Input
                id="diag-campaign"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diag-request">Request ID</Label>
              <Input
                id="diag-request"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                placeholder="Optional X-Request-ID"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setTimelineEnabled(true)}
              disabled={!hasTimelineFilter}
            >
              Load timeline
            </Button>
            {customerId.trim() ? (
              <Button type="button" variant="outline" asChild>
                <Link href={`/patrons/${customerId.trim()}`}>Open patron</Link>
              </Button>
            ) : null}
          </div>
          {timelineQuery.isFetching ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : null}
          {timelineQuery.data?.items?.length ? (
            <ol className="space-y-2">
              {timelineQuery.data.items.map((item) => (
                <li key={item.id} className="border-border/60 rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.kind}</Badge>
                    {item.status ? <StatusPill value={item.status} /> : null}
                    {item.channel ? (
                      <span className="text-muted-foreground text-xs">{item.channel}</span>
                    ) : null}
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatWhen(item.at)}
                    </span>
                  </div>
                  <p className="mt-1 font-medium">{item.title}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {[
                      item.requestId ? `req ${item.requestId}` : null,
                      item.providerMessageId ? `sid ${item.providerMessageId}` : null,
                      item.campaignSendId ? `send ${item.campaignSendId.slice(0, 8)}` : null,
                      item.error,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </li>
              ))}
            </ol>
          ) : timelineEnabled ? (
            <p className="text-muted-foreground text-sm">No timeline rows for those filters.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration event log</CardTitle>
          <CardDescription>
            Redacted queue-events / POS / points ingest rows with outcome and idempotency key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(eventsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">
              No events yet. Connector traffic will appear here after the next ingest.
            </p>
          ) : (
            eventsQuery.data!.items.map((evt) => (
              <div key={evt.id} className="border-border/60 rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{evt.route}</span>
                  <StatusPill value={evt.outcome} />
                  {evt.event ? (
                    <span className="text-muted-foreground text-xs">{evt.event}</span>
                  ) : null}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {formatWhen(evt.at)}
                    {evt.durationMs != null ? ` · ${evt.durationMs}ms` : ''}
                  </span>
                </div>
                <p className="text-muted-foreground font-mono text-xs">
                  {[
                    evt.sourceId ? `source ${evt.sourceId}` : null,
                    evt.idempotencyKey ? `idem ${evt.idempotencyKey}` : null,
                    evt.requestId ? `req ${evt.requestId}` : null,
                    evt.httpStatus != null ? `http ${evt.httpStatus}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
