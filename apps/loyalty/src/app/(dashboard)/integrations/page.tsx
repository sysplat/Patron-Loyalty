'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost, unwrapApiData } from '@/lib/api-response';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LOYALTY_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKeyStatus {
  configured: boolean;
  prefix: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: string;
}

interface PosConnection {
  provider: 'square' | 'clover';
  status: string;
  createdAt: string;
  updatedAt: string;
  config: Record<string, string>;
}

interface MarketingConnection {
  provider: 'klaviyo' | 'mailchimp';
  status: string;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  config: Record<string, string>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STALE_KEY_DAYS = 30;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const LOYALTY_EVENT_OPTIONS = Object.values(LOYALTY_WEBHOOK_EVENTS);

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(dt: string | null | undefined): string {
  if (!dt) return 'Never';
  return new Date(dt).toLocaleString();
}

function isStale(dt: string | null | undefined): boolean {
  if (!dt) return true;
  return Date.now() - new Date(dt).getTime() > STALE_KEY_DAYS * 86_400_000;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="bg-border h-px flex-1" />
      <span className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
        {label}
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">
      {status}
    </Badge>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  // ── API Key state ───────────────────────────────────────────────────────────
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // ── Webhook state ───────────────────────────────────────────────────────────
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    LOYALTY_WEBHOOK_EVENTS.POINTS_EARNED,
  ]);
  const [revealedWebhookSecret, setRevealedWebhookSecret] = useState<{
    id: string;
    secret: string;
  } | null>(null);

  // ── POS form state ──────────────────────────────────────────────────────────
  const [squareForm, setSquareForm] = useState({
    locationId: '',
    accessToken: '',
    webhookSignatureKey: '',
  });
  const [cloverForm, setCloverForm] = useState({
    merchantId: '',
    accessToken: '',
    webhookSignatureKey: '',
  });

  // ── Marketing form state ────────────────────────────────────────────────────
  const [klaviyoForm, setKlaviyoForm] = useState({ apiKey: '' });
  const [mailchimpForm, setMailchimpForm] = useState({ apiKey: '', listId: '', serverPrefix: '' });

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: apiKeyStatus, isLoading: apiKeyLoading } = useQuery({
    queryKey: ['loyalty', 'integrations', 'api-key'],
    queryFn: () => loyaltyGet<ApiKeyStatus>('/loyalty/integrations/api-key', token!),
    enabled: !!token,
  });

  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () =>
      api
        .get<{ success: boolean; data: WebhookEndpoint[] }>('/webhooks', { token: token! })
        .then((p) => unwrapApiData<WebhookEndpoint[]>(p)),
    enabled: !!token,
  });

  const { data: posConnections = [], isLoading: posLoading } = useQuery({
    queryKey: ['loyalty', 'integrations', 'pos'],
    queryFn: () =>
      loyaltyPost<PosConnection[]>('/loyalty/integrations/pos/staff', token!).catch(
        () => [] as PosConnection[],
      ),
    enabled: !!token,
  });

  const { data: marketingConnections = [], isLoading: marketingLoading } = useQuery({
    queryKey: ['loyalty', 'integrations', 'marketing'],
    queryFn: () =>
      loyaltyGet<MarketingConnection[]>('/loyalty/integrations/marketing', token!).catch(
        () => [] as MarketingConnection[],
      ),
    enabled: !!token,
  });

  // ─── Mutations: API key ─────────────────────────────────────────────────────

  const rotateApiKey = useMutation({
    mutationFn: () =>
      loyaltyPost<{ apiKey: string; prefix: string }>(
        '/loyalty/integrations/api-key/rotate',
        token!,
      ),
    onSuccess: (d) => {
      setRevealedKey(d.apiKey);
      toast.success('New API key generated — copy it now');
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'api-key'] });
    },
    onError: () => toast.error('Could not generate API key'),
  });

  const revokeApiKey = useMutation({
    mutationFn: () => loyaltyPost('/loyalty/integrations/api-key/revoke', token!),
    onSuccess: () => {
      setRevealedKey(null);
      toast.success('API key revoked');
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'api-key'] });
    },
    onError: () => toast.error('Could not revoke API key'),
  });

  // ─── Mutations: Webhooks ────────────────────────────────────────────────────

  const createWebhook = useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; data: WebhookEndpoint }>(
        '/webhooks',
        { url: webhookUrl.trim(), events: selectedEvents },
        { token: token! },
      ),
    onSuccess: () => {
      toast.success('Webhook created');
      setWebhookUrl('');
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: () => toast.error('Could not create webhook — use an HTTPS URL'),
  });

  const rotateWebhookSecret = useMutation({
    mutationFn: (id: string) =>
      api
        .post<{
          success: boolean;
          data: WebhookEndpoint & { secret: string };
        }>(`/webhooks/${id}/rotate-secret`, {}, { token: token! })
        .then((p) => unwrapApiData<WebhookEndpoint & { secret: string }>(p)),
    onSuccess: (d) => {
      setRevealedWebhookSecret({ id: d.id, secret: d.secret });
      toast.success('New signing secret — copy it now');
    },
    onError: () => toast.error('Could not rotate webhook secret'),
  });

  const deleteWebhook = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`, { token: token! }),
    onSuccess: () => {
      toast.success('Webhook removed');
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: () => toast.error('Could not delete webhook'),
  });

  // ─── Mutations: POS ─────────────────────────────────────────────────────────

  const upsertSquare = useMutation({
    mutationFn: () =>
      loyaltyPost<PosConnection>('/loyalty/integrations/pos/square', token!, squareForm),
    onSuccess: () => {
      toast.success('Square connection saved');
      setSquareForm({ locationId: '', accessToken: '', webhookSignatureKey: '' });
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'pos'] });
    },
    onError: () => toast.error('Could not save Square connection'),
  });

  const upsertClover = useMutation({
    mutationFn: () =>
      loyaltyPost<PosConnection>('/loyalty/integrations/pos/clover', token!, cloverForm),
    onSuccess: () => {
      toast.success('Clover connection saved');
      setCloverForm({ merchantId: '', accessToken: '', webhookSignatureKey: '' });
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'pos'] });
    },
    onError: () => toast.error('Could not save Clover connection'),
  });

  const deletePos = useMutation({
    mutationFn: (provider: string) =>
      loyaltyPost(`/loyalty/integrations/pos/${provider}/delete`, token!),
    onSuccess: (_d, provider) => {
      toast.success(`${provider} connection removed`);
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'pos'] });
    },
    onError: () => toast.error('Could not remove POS connection'),
  });

  // ─── Mutations: Marketing ────────────────────────────────────────────────────

  const upsertKlaviyo = useMutation({
    mutationFn: () =>
      loyaltyPost<MarketingConnection>(
        '/loyalty/integrations/marketing/klaviyo',
        token!,
        klaviyoForm,
      ),
    onSuccess: () => {
      toast.success('Klaviyo connected');
      setKlaviyoForm({ apiKey: '' });
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'marketing'] });
    },
    onError: () => toast.error('Could not save Klaviyo connection'),
  });

  const upsertMailchimp = useMutation({
    mutationFn: () =>
      loyaltyPost<MarketingConnection>(
        '/loyalty/integrations/marketing/mailchimp',
        token!,
        mailchimpForm,
      ),
    onSuccess: () => {
      toast.success('Mailchimp connected');
      setMailchimpForm({ apiKey: '', listId: '', serverPrefix: '' });
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'marketing'] });
    },
    onError: () => toast.error('Could not save Mailchimp connection'),
  });

  const deleteMarketing = useMutation({
    mutationFn: (provider: string) =>
      loyaltyPost(`/loyalty/integrations/marketing/${provider}/delete`, token!),
    onSuccess: (_d, provider) => {
      toast.success(`${provider} connection removed`);
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'marketing'] });
    },
    onError: () => toast.error('Could not remove marketing connection'),
  });

  const syncAll = useMutation({
    mutationFn: () =>
      loyaltyPost<{ synced: number; errors: number }>(
        '/loyalty/integrations/marketing/sync',
        token!,
      ),
    onSuccess: (d) =>
      toast.success(`Sync complete — ${d.synced} profiles synced, ${d.errors} errors`),
    onError: () => toast.error('Sync failed'),
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const toggleEvent = (e: string) =>
    setSelectedEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const posConnection = (provider: 'square' | 'clover') =>
    posConnections.find((c) => c.provider === provider);

  const marketingConnection = (provider: 'klaviyo' | 'mailchimp') =>
    marketingConnections.find((c) => c.provider === provider);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Integrations</h1>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Connect POS systems, marketing platforms, and custom apps to award points and sync patron
        profiles automatically.
      </p>

      {/* ── API Key ─────────────────────────────────────────────────────────── */}
      <SectionDivider label="Generic API" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integration API key</CardTitle>
          <CardDescription>
            Use <code className="text-xs">X-Loyalty-Api-Key</code> on any{' '}
            <code className="text-xs">POST /loyalty/integrations/v1/*</code> call.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeyLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <p className="text-sm">
                Status:{' '}
                <span className="font-medium">
                  {apiKeyStatus?.configured
                    ? `Configured (${apiKeyStatus.prefix}…)`
                    : 'Not configured'}
                </span>
                {apiKeyStatus?.createdAt && (
                  <span className="text-muted-foreground">
                    {' '}
                    · Created {formatDate(apiKeyStatus.createdAt)}
                  </span>
                )}
              </p>
              {apiKeyStatus?.configured && (
                <p className="text-sm">
                  Last used:{' '}
                  <span
                    className={
                      isStale(apiKeyStatus.lastUsedAt)
                        ? 'font-medium text-amber-600'
                        : 'font-medium'
                    }
                  >
                    {formatDate(apiKeyStatus.lastUsedAt)}
                  </span>
                  {isStale(apiKeyStatus.lastUsedAt) && (
                    <span className="text-muted-foreground">
                      {' '}
                      · No traffic in {STALE_KEY_DAYS}+ days
                    </span>
                  )}
                </p>
              )}
              {revealedKey && (
                <div className="bg-muted break-all rounded-lg p-3 font-mono text-xs">
                  {revealedKey}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => rotateApiKey.mutate()} disabled={rotateApiKey.isPending}>
                  {apiKeyStatus?.configured ? 'Rotate key' : 'Generate key'}
                </Button>
                {apiKeyStatus?.configured && (
                  <Button
                    variant="outline"
                    onClick={() => revokeApiKey.mutate()}
                    disabled={revokeApiKey.isPending}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 font-mono text-xs">
          <p>POST {API_BASE}/loyalty/integrations/v1/customers/upsert</p>
          <p>GET {API_BASE}/loyalty/integrations/v1/customers/lookup?phone=…</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/points/earn</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/rewards/redeem</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/coupons/validate</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/coupons/redeem</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/wallet/adjust</p>
        </CardContent>
      </Card>

      {/* ── POS Integrations ─────────────────────────────────────────────────── */}
      <SectionDivider label="Point of Sale" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Square */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">Square</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Automatically award points when a Square payment completes.
              </CardDescription>
            </div>
            {posConnection('square') && <StatusBadge status={posConnection('square')!.status} />}
          </CardHeader>
          <CardContent className="space-y-4">
            {posLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : posConnection('square') ? (
              <div className="space-y-2">
                <p className="text-sm">
                  Location ID:{' '}
                  <span className="font-mono text-xs">
                    {posConnection('square')!.config.locationId}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Connected {formatDate(posConnection('square')!.createdAt)}
                </p>
                <p className="text-muted-foreground break-all font-mono text-xs">
                  Webhook URL: {API_BASE}/loyalty/integrations/pos/square/webhook?orgId=YOUR_ORG_ID
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deletePos.mutate('square')}
                  disabled={deletePos.isPending}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="sq-location" className="text-xs">
                    Location ID
                  </Label>
                  <Input
                    id="sq-location"
                    placeholder="LxxxxxxxxxxxxxxxxxxxxX"
                    value={squareForm.locationId}
                    onChange={(e) => setSquareForm((f) => ({ ...f, locationId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sq-token" className="text-xs">
                    Access Token
                  </Label>
                  <Input
                    id="sq-token"
                    type="password"
                    placeholder="EAAAl…"
                    value={squareForm.accessToken}
                    onChange={(e) => setSquareForm((f) => ({ ...f, accessToken: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sq-sig" className="text-xs">
                    Webhook Signature Key
                  </Label>
                  <Input
                    id="sq-sig"
                    type="password"
                    placeholder="From Square Dashboard → Webhooks"
                    value={squareForm.webhookSignatureKey}
                    onChange={(e) =>
                      setSquareForm((f) => ({ ...f, webhookSignatureKey: e.target.value }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => upsertSquare.mutate()}
                  disabled={
                    upsertSquare.isPending ||
                    !squareForm.locationId ||
                    !squareForm.accessToken ||
                    !squareForm.webhookSignatureKey
                  }
                >
                  Connect Square
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clover */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">Clover</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Automatically award points when a Clover order is paid.
              </CardDescription>
            </div>
            {posConnection('clover') && <StatusBadge status={posConnection('clover')!.status} />}
          </CardHeader>
          <CardContent className="space-y-4">
            {posLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : posConnection('clover') ? (
              <div className="space-y-2">
                <p className="text-sm">
                  Merchant ID:{' '}
                  <span className="font-mono text-xs">
                    {posConnection('clover')!.config.merchantId}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Connected {formatDate(posConnection('clover')!.createdAt)}
                </p>
                <p className="text-muted-foreground break-all font-mono text-xs">
                  Webhook URL: {API_BASE}/loyalty/integrations/pos/clover/webhook?orgId=YOUR_ORG_ID
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deletePos.mutate('clover')}
                  disabled={deletePos.isPending}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="clv-merchant" className="text-xs">
                    Merchant ID
                  </Label>
                  <Input
                    id="clv-merchant"
                    placeholder="MxxxxxxxxxxxxxxxxxxxxxxX"
                    value={cloverForm.merchantId}
                    onChange={(e) => setCloverForm((f) => ({ ...f, merchantId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clv-token" className="text-xs">
                    Access Token
                  </Label>
                  <Input
                    id="clv-token"
                    type="password"
                    placeholder="From Clover Developer Dashboard"
                    value={cloverForm.accessToken}
                    onChange={(e) => setCloverForm((f) => ({ ...f, accessToken: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clv-sig" className="text-xs">
                    Webhook Shared Secret
                  </Label>
                  <Input
                    id="clv-sig"
                    type="password"
                    placeholder="From Clover Developer Dashboard → Webhooks"
                    value={cloverForm.webhookSignatureKey}
                    onChange={(e) =>
                      setCloverForm((f) => ({ ...f, webhookSignatureKey: e.target.value }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => upsertClover.mutate()}
                  disabled={
                    upsertClover.isPending ||
                    !cloverForm.merchantId ||
                    !cloverForm.accessToken ||
                    !cloverForm.webhookSignatureKey
                  }
                >
                  Connect Clover
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Marketing Sync ───────────────────────────────────────────────────── */}
      <SectionDivider label="Marketing Ecosystem" />

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground max-w-xl text-sm">
          Loyalty profile fields (points, tier, referral URL) are pushed to connected platforms in
          real-time whenever a patron earns points, is tier-upgraded, or joins.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncAll.mutate()}
          disabled={syncAll.isPending || marketingConnections.length === 0}
        >
          {syncAll.isPending ? 'Syncing…' : 'Sync all now'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Klaviyo */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">Klaviyo</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Pushes loyalty custom properties to Klaviyo profiles for flow triggers and
                segmentation.
              </CardDescription>
            </div>
            {marketingConnection('klaviyo') && (
              <StatusBadge status={marketingConnection('klaviyo')!.status} />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {marketingLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : marketingConnection('klaviyo') ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  Last synced: {formatDate(marketingConnection('klaviyo')!.syncedAt)}
                </p>
                <p className="text-muted-foreground text-xs">
                  Properties synced:{' '}
                  <code className="text-xs">
                    loyalty_points, loyalty_tier, loyalty_lifetime_value_cents,
                    loyalty_total_visits, loyalty_referral_url
                  </code>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteMarketing.mutate('klaviyo')}
                  disabled={deleteMarketing.isPending}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="klv-key" className="text-xs">
                    Private API Key
                  </Label>
                  <Input
                    id="klv-key"
                    type="password"
                    placeholder="pk_live_…"
                    value={klaviyoForm.apiKey}
                    onChange={(e) => setKlaviyoForm({ apiKey: e.target.value })}
                  />
                  <p className="text-muted-foreground text-xs">
                    Account → Settings → API Keys → Create Private API Key
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => upsertKlaviyo.mutate()}
                  disabled={upsertKlaviyo.isPending || !klaviyoForm.apiKey}
                >
                  Connect Klaviyo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mailchimp */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">Mailchimp</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Pushes loyalty merge fields to your Mailchimp audience for automated journeys.
              </CardDescription>
            </div>
            {marketingConnection('mailchimp') && (
              <StatusBadge status={marketingConnection('mailchimp')!.status} />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {marketingLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : marketingConnection('mailchimp') ? (
              <div className="space-y-2">
                <p className="text-sm">
                  List ID:{' '}
                  <span className="font-mono text-xs">
                    {marketingConnection('mailchimp')!.config.listId}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Last synced: {formatDate(marketingConnection('mailchimp')!.syncedAt)}
                </p>
                <p className="text-muted-foreground text-xs">
                  Merge fields synced:{' '}
                  <code className="text-xs">LPOINTS, LTIER, LTOTVIS, LREFURL</code>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteMarketing.mutate('mailchimp')}
                  disabled={deleteMarketing.isPending}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="mc-key" className="text-xs">
                    API Key
                  </Label>
                  <Input
                    id="mc-key"
                    type="password"
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us10"
                    value={mailchimpForm.apiKey}
                    onChange={(e) => setMailchimpForm((f) => ({ ...f, apiKey: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mc-list" className="text-xs">
                    Audience (List) ID
                  </Label>
                  <Input
                    id="mc-list"
                    placeholder="abc123def"
                    value={mailchimpForm.listId}
                    onChange={(e) => setMailchimpForm((f) => ({ ...f, listId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mc-server" className="text-xs">
                    Server Prefix
                  </Label>
                  <Input
                    id="mc-server"
                    placeholder="us10"
                    value={mailchimpForm.serverPrefix}
                    onChange={(e) =>
                      setMailchimpForm((f) => ({ ...f, serverPrefix: e.target.value }))
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    Last 4 chars of your API key, e.g. &quot;us10&quot;
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => upsertMailchimp.mutate()}
                  disabled={
                    upsertMailchimp.isPending ||
                    !mailchimpForm.apiKey ||
                    !mailchimpForm.listId ||
                    !mailchimpForm.serverPrefix
                  }
                >
                  Connect Mailchimp
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Outbound Webhooks ─────────────────────────────────────────────────── */}
      <SectionDivider label="Outbound Webhooks" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook endpoints</CardTitle>
          <CardDescription>
            Receive HTTPS callbacks when loyalty events occur (points earned, tier upgrades, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="https://your-server.com/webhooks/loyalty"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {LOYALTY_EVENT_OPTIONS.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(event)}
                  className={`rounded-full border px-2 py-1 font-mono text-xs ${
                    selectedEvents.includes(event)
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
            <Button
              onClick={() => createWebhook.mutate()}
              disabled={
                !webhookUrl.startsWith('https://') ||
                selectedEvents.length === 0 ||
                createWebhook.isPending
              }
            >
              Add webhook
            </Button>
          </div>

          {webhooksLoading ? (
            <p className="text-muted-foreground text-sm">Loading webhooks…</p>
          ) : webhooks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No webhooks configured yet.</p>
          ) : (
            <ul className="space-y-3">
              {webhooks.map((hook) => (
                <li
                  key={hook.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="break-all font-mono text-xs">{hook.url}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {hook.status} · {hook.events.join(', ')}
                    </p>
                    {revealedWebhookSecret?.id === hook.id && (
                      <div className="bg-muted mt-2 break-all rounded-lg p-2 font-mono text-xs">
                        {revealedWebhookSecret.secret}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rotateWebhookSecret.mutate(hook.id)}
                      disabled={rotateWebhookSecret.isPending}
                    >
                      Rotate secret
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteWebhook.mutate(hook.id)}
                      disabled={deleteWebhook.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
