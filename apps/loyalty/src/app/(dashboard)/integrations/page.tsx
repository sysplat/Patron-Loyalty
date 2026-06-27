'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost, unwrapApiData } from '@/lib/api-response';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LOYALTY_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { toast } from 'sonner';

interface ApiKeyStatus {
  configured: boolean;
  prefix: string | null;
  createdAt: string | null;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const LOYALTY_EVENT_OPTIONS = Object.values(LOYALTY_WEBHOOK_EVENTS);

export default function IntegrationsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    LOYALTY_WEBHOOK_EVENTS.POINTS_EARNED,
  ]);
  const [revealedWebhookSecret, setRevealedWebhookSecret] = useState<{
    id: string;
    secret: string;
  } | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ['loyalty', 'integrations', 'api-key'],
    queryFn: () => loyaltyGet<ApiKeyStatus>('/loyalty/integrations/api-key', token!),
    enabled: !!token,
  });

  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () =>
      api
        .get<{ success: boolean; data: WebhookEndpoint[] }>('/webhooks', { token: token! })
        .then((payload) => unwrapApiData<WebhookEndpoint[]>(payload)),
    enabled: !!token,
  });

  const rotate = useMutation({
    mutationFn: () =>
      loyaltyPost<{ apiKey: string; prefix: string }>(
        '/loyalty/integrations/api-key/rotate',
        token!,
      ),
    onSuccess: (data) => {
      setRevealedKey(data.apiKey);
      toast.success('New API key generated — copy it now');
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'api-key'] });
    },
    onError: () => toast.error('Could not generate API key'),
  });

  const revoke = useMutation({
    mutationFn: () => loyaltyPost('/loyalty/integrations/api-key/revoke', token!),
    onSuccess: () => {
      setRevealedKey(null);
      toast.success('API key revoked');
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations', 'api-key'] });
    },
    onError: () => toast.error('Could not revoke API key'),
  });

  const createWebhook = useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; data: WebhookEndpoint }>(
        '/webhooks',
        { url: webhookUrl.trim(), events: selectedEvents },
        { token: token! },
      ),
    onSuccess: () => {
      toast.success('Webhook endpoint created — rotate the signing secret to reveal it once');
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
        .then((payload) => unwrapApiData<WebhookEndpoint & { secret: string }>(payload)),
    onSuccess: (data) => {
      setRevealedWebhookSecret({ id: data.id, secret: data.secret });
      toast.success('New signing secret — copy it now; it will not be shown again');
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

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Integrations</h1>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Connect POS, e-commerce, or custom apps to award points and redeem rewards without QlessQ
        queue events. Use the API key in the <code className="text-xs">X-Loyalty-Api-Key</code>{' '}
        header.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <p className="text-sm">
                Status:{' '}
                <span className="font-medium">
                  {status?.configured ? `Configured (${status.prefix}…)` : 'Not configured'}
                </span>
                {status?.createdAt ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · Created {new Date(status.createdAt).toLocaleString()}
                  </span>
                ) : null}
              </p>
              {revealedKey && (
                <div className="bg-muted break-all rounded-lg p-3 font-mono text-xs">
                  {revealedKey}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => rotate.mutate()} disabled={rotate.isPending}>
                  {status?.configured ? 'Rotate key' : 'Generate key'}
                </Button>
                {status?.configured && (
                  <Button
                    variant="outline"
                    onClick={() => revoke.mutate()}
                    disabled={revoke.isPending}
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
          <CardTitle className="text-base">Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs">
          <p>POST {API_BASE}/loyalty/integrations/v1/customers/upsert</p>
          <p>GET {API_BASE}/loyalty/integrations/v1/customers/lookup?phone=…</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/points/earn</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/rewards/redeem</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/coupons/validate</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/coupons/redeem</p>
          <p>POST {API_BASE}/loyalty/integrations/v1/wallet/adjust</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outbound webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Receive HTTPS callbacks when loyalty events occur (points earned, tier upgrades, etc.).
          </p>

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
