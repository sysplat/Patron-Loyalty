'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CUSTOMER_SEGMENT_PRESET_LABELS,
  CUSTOMER_SEGMENT_PRESET_VALUES,
} from '@queueplatform/shared';
import { loyaltyGet, loyaltyPatch, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  channel: string;
  trigger: string;
  status: string;
  sentCount: number;
  segmentPreset?: string | null;
  scheduledAt?: string | null;
  subject?: string | null;
  body?: string | null;
}

const TRIGGERS = [
  'MANUAL',
  'WELCOME',
  'BIRTHDAY',
  'WIN_BACK',
  'TIER_UPGRADE',
  'ABANDONED',
] as const;

const CHANNELS = ['EMAIL', 'SMS', 'IN_APP'] as const;

export default function CampaignsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<string>('MANUAL');
  const [channel, setChannel] = useState<string>('EMAIL');
  const [body, setBody] = useState('');
  const [segmentPreset, setSegmentPreset] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const { data: campaigns = [] } = useQuery({
    queryKey: ['loyalty', 'campaigns'],
    queryFn: () => loyaltyGet<Campaign[]>('/loyalty/campaigns', token!),
    enabled: !!token,
  });

  const create = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/campaigns', token!, {
        name,
        channel,
        trigger,
        subject: name,
        body,
        segmentPreset: segmentPreset || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      }),
    onSuccess: () => {
      toast.success('Campaign created');
      setName('');
      setBody('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'campaigns'] });
    },
  });

  const launch = useMutation({
    mutationFn: (id: string) =>
      loyaltyPost<{ sent?: number; skipped?: number }>(`/loyalty/campaigns/${id}/launch`, token!),
    onSuccess: (data) => {
      toast.success(`Campaign launched: ${data.sent ?? 0} sent, ${data.skipped ?? 0} skipped`);
      qc.invalidateQueries({ queryKey: ['loyalty', 'campaigns'] });
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) =>
      loyaltyPatch(`/loyalty/campaigns/${id}`, token!, { status: 'active' }),
    onSuccess: () => {
      toast.success('Automation enabled');
      qc.invalidateQueries({ queryKey: ['loyalty', 'campaigns'] });
    },
    onError: () => toast.error('Could not activate campaign'),
  });

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Marketing campaigns</h1>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Set trigger to Welcome, Birthday, Win-back, Tier upgrade, or Abandoned, then activate for
        automatic sends. Manual campaigns use Launch for one-time blasts.
      </p>
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Campaign name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={segmentPreset}
              onChange={(e) => setSegmentPreset(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              <option value="">All loyalty members</option>
              {CUSTOMER_SEGMENT_PRESET_VALUES.map((preset) => (
                <option key={preset} value={preset}>
                  {CUSTOMER_SEGMENT_PRESET_LABELS[preset]}
                </option>
              ))}
            </select>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="max-w-[200px]"
              title="Schedule launch (manual campaigns)"
            />
          </div>
          <Input
            placeholder="Message body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            Create draft
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground text-sm">
                  {c.channel} · {c.trigger} · {c.status} · {c.sentCount} sent
                  {c.segmentPreset ? ` · segment: ${c.segmentPreset}` : ''}
                  {c.scheduledAt ? ` · scheduled ${new Date(c.scheduledAt).toLocaleString()}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.status === 'draft' && c.trigger !== 'MANUAL' && (
                  <Button size="sm" variant="secondary" onClick={() => activate.mutate(c.id)}>
                    Enable automation
                  </Button>
                )}
                {c.status === 'draft' && c.trigger === 'MANUAL' && (
                  <Button size="sm" variant="outline" onClick={() => launch.mutate(c.id)}>
                    Launch now
                  </Button>
                )}
                {c.status === 'scheduled' && c.trigger === 'MANUAL' && (
                  <span className="text-muted-foreground text-xs">Awaiting schedule</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
