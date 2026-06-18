'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LOYALTY_WEBHOOK_EVENTS } from '@queueplatform/shared';
import { toast } from 'sonner';

interface ApiKeyStatus {
  configured: boolean;
  prefix: string | null;
  createdAt: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function IntegrationsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ['loyalty', 'integrations', 'api-key'],
    queryFn: () => loyaltyGet<ApiKeyStatus>('/loyalty/integrations/api-key', token!),
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
          <CardTitle className="text-base">Outbound webhook events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Configure tenant webhooks in QMS settings to receive loyalty events:
          </p>
          <ul className="font-mono text-xs">
            {Object.values(LOYALTY_WEBHOOK_EVENTS).map((event) => (
              <li key={event}>{event}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
