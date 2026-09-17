'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CUSTOMER_SEGMENT_PRESET_LABELS,
  CUSTOMER_SEGMENT_PRESET_VALUES,
} from '@queueplatform/shared';
import { loyaltyGet, loyaltyPatch, loyaltyPost, loyaltyDelete } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Trash2, Megaphone, ChevronDown, ChevronUp, Plus, BookOpen } from 'lucide-react';

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

const CHANNELS = ['EMAIL', 'SMS', 'IN_APP', 'WHATSAPP', 'PUSH'] as const;

type Trigger = (typeof TRIGGERS)[number];
type Channel = (typeof CHANNELS)[number];
type ListFilter = 'all' | 'draft' | 'active' | 'manual' | 'automation';

const TRIGGER_META: Record<
  Trigger,
  { label: string; description: string; kind: 'manual' | 'automation' }
> = {
  MANUAL: {
    label: 'One-time send',
    description: 'You launch when ready. Use for promos and announcements.',
    kind: 'manual',
  },
  WELCOME: {
    label: 'Welcome',
    description: 'Fires when a member joins the loyalty program.',
    kind: 'automation',
  },
  BIRTHDAY: {
    label: 'Birthday',
    description: 'Fires around the member birthday (set on the customer profile).',
    kind: 'automation',
  },
  WIN_BACK: {
    label: 'Win-back',
    description: 'Reaches members who have become inactive.',
    kind: 'automation',
  },
  TIER_UPGRADE: {
    label: 'Tier upgrade',
    description: 'Fires when a member moves up a tier.',
    kind: 'automation',
  },
  ABANDONED: {
    label: 'Abandoned',
    description: 'Follows up on incomplete visits or checkouts.',
    kind: 'automation',
  },
};

const CHANNEL_META: Record<Channel, { label: string; hint: string }> = {
  EMAIL: { label: 'Email', hint: 'Longer offers and links.' },
  SMS: { label: 'SMS', hint: 'Short copy. Only marketing SMS opt-ins.' },
  IN_APP: { label: 'In-app', hint: 'Shown in the patron portal.' },
  WHATSAPP: { label: 'WhatsApp', hint: 'Requires WhatsApp to be configured.' },
  PUSH: { label: 'Push', hint: 'Requires push to be configured.' },
};

function selectClassName(className?: string) {
  return cn(
    'border-input bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  );
}

function triggerLabel(trigger: string): string {
  return TRIGGER_META[trigger as Trigger]?.label ?? trigger;
}

function channelLabel(channel: string): string {
  return CHANNEL_META[channel as Channel]?.label ?? channel;
}

function segmentLabel(preset?: string | null): string {
  if (!preset) return 'All members';
  return (
    CUSTOMER_SEGMENT_PRESET_LABELS[preset as keyof typeof CUSTOMER_SEGMENT_PRESET_LABELS] ?? preset
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'border-transparent bg-muted text-muted-foreground',
    scheduled: 'border-transparent bg-muted text-foreground',
    active: 'border-transparent bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    completed: 'border-transparent bg-muted text-muted-foreground',
  };
  const labels: Record<string, string> = {
    draft: 'Draft',
    scheduled: 'Scheduled',
    active: 'Active',
    completed: 'Completed',
  };
  return (
    <Badge
      variant="secondary"
      className={cn(
        'font-normal',
        styles[status] ?? 'bg-muted text-muted-foreground border-transparent',
      )}
    >
      {labels[status] ?? status}
    </Badge>
  );
}

export default function CampaignsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [guideOpen, setGuideOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<Trigger>('MANUAL');
  const [channel, setChannel] = useState<Channel>('EMAIL');
  const [body, setBody] = useState('');
  const [segmentPreset, setSegmentPreset] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const { data: campaigns = [], isLoading } = useQuery({
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
      toast.success('Draft saved');
      setName('');
      setBody('');
      setScheduledAt('');
      setSegmentPreset('');
      setTrigger('MANUAL');
      setChannel('EMAIL');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'campaigns'] });
    },
    onError: () => toast.error('Could not create campaign'),
  });

  const launch = useMutation({
    mutationFn: (id: string) =>
      loyaltyPost<{ sent?: number; skipped?: number }>(`/loyalty/campaigns/${id}/launch`, token!),
    onSuccess: (data) => {
      toast.success(`Launched · ${data.sent ?? 0} sent · ${data.skipped ?? 0} skipped`);
      qc.invalidateQueries({ queryKey: ['loyalty', 'campaigns'] });
    },
    onError: () => toast.error('Launch failed'),
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

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => loyaltyDelete(`/loyalty/campaigns/${id}`, token!),
    onSuccess: () => {
      toast.success('Campaign deleted');
      qc.invalidateQueries({ queryKey: ['loyalty', 'campaigns'] });
    },
    onError: () => toast.error('Failed to delete campaign'),
  });

  const triggerInfo = TRIGGER_META[trigger];
  const channelInfo = CHANNEL_META[channel];
  const isManual = trigger === 'MANUAL';

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      switch (listFilter) {
        case 'draft':
          return c.status === 'draft' || c.status === 'scheduled';
        case 'active':
          return c.status === 'active';
        case 'manual':
          return c.trigger === 'MANUAL';
        case 'automation':
          return c.trigger !== 'MANUAL';
        case 'all':
          return true;
        default: {
          const _exhaustive: never = listFilter;
          return _exhaustive;
        }
      }
    });
  }, [campaigns, listFilter]);

  const stats = useMemo(() => {
    const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
    return {
      drafts: campaigns.filter((c) => c.status === 'draft' || c.status === 'scheduled').length,
      active: campaigns.filter((c) => c.status === 'active').length,
      automations: campaigns.filter((c) => c.trigger !== 'MANUAL' && c.status === 'active').length,
      totalSent,
    };
  }, [campaigns]);

  const filterTabs: { id: ListFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'active', label: 'Active' },
    { id: 'manual', label: 'One-time' },
    { id: 'automation', label: 'Automations' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Campaigns</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            One-time sends and automatic journeys for loyalty members.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setGuideOpen((v) => !v)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Guide
            {guideOpen ? (
              <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            )}
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            {createOpen ? 'Close' : 'New campaign'}
          </Button>
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Staff guide</CardTitle>
            <CardDescription>
              Draft first — nothing sends until you launch or enable automation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <li className="space-y-1">
                <p className="text-foreground font-medium">1. Audience</p>
                <p className="text-xs leading-relaxed">
                  All members, or a segment (VIP, inactive, SMS opt-in).
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">2. Timing</p>
                <p className="text-xs leading-relaxed">
                  One-time (you launch) or automation (Welcome, Birthday, Win-back).
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">3. Message</p>
                <p className="text-xs leading-relaxed">
                  Keep SMS short. Email can carry the full offer and link.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">4. Go live</p>
                <p className="text-xs leading-relaxed">
                  Manual → Launch now. Automation → Enable automation.
                </p>
              </li>
            </ol>
            <p className="border-border/70 text-muted-foreground border-t pt-3 text-xs leading-relaxed">
              SMS only reaches patrons with marketing SMS opt-in. Confirm consent on{' '}
              <Link
                href="/patrons"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                Customers
              </Link>{' '}
              before a large blast. Birthday automations need a birthday on the profile.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Drafts', value: stats.drafts },
          { label: 'Active', value: stats.active },
          { label: 'Live automations', value: stats.automations },
          { label: 'Messages sent', value: stats.totalSent },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {createOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New campaign</CardTitle>
            <CardDescription>
              Creates a draft. Review it in the list, then launch or enable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) {
                  toast.error('Add a campaign name');
                  return;
                }
                if (!body.trim()) {
                  toast.error('Add a message');
                  return;
                }
                create.mutate();
              }}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="campaign-name">Name</Label>
                    <Input
                      id="campaign-name"
                      placeholder="March VIP invite"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="campaign-trigger">When it sends</Label>
                    <select
                      id="campaign-trigger"
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value as Trigger)}
                      className={selectClassName()}
                    >
                      <optgroup label="One-time">
                        <option value="MANUAL">{TRIGGER_META.MANUAL.label}</option>
                      </optgroup>
                      <optgroup label="Automations">
                        {TRIGGERS.filter((t) => t !== 'MANUAL').map((t) => (
                          <option key={t} value={t}>
                            {TRIGGER_META[t].label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="text-muted-foreground text-xs">{triggerInfo.description}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="campaign-channel">Channel</Label>
                      <select
                        id="campaign-channel"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as Channel)}
                        className={selectClassName()}
                      >
                        {CHANNELS.map((c) => (
                          <option key={c} value={c}>
                            {CHANNEL_META[c].label}
                          </option>
                        ))}
                      </select>
                      <p className="text-muted-foreground text-xs">{channelInfo.hint}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="campaign-segment">Audience</Label>
                      <select
                        id="campaign-segment"
                        value={segmentPreset}
                        onChange={(e) => setSegmentPreset(e.target.value)}
                        className={selectClassName()}
                      >
                        <option value="">All loyalty members</option>
                        {CUSTOMER_SEGMENT_PRESET_VALUES.map((preset) => (
                          <option key={preset} value={preset}>
                            {CUSTOMER_SEGMENT_PRESET_LABELS[preset]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {isManual ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="campaign-schedule">Schedule (optional)</Label>
                      <Input
                        id="campaign-schedule"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                      />
                      <p className="text-muted-foreground text-xs">
                        Leave blank to keep as a draft you launch manually.
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs leading-relaxed">
                      After saving, use{' '}
                      <span className="text-foreground font-medium">Enable automation</span> on the
                      draft. It sends when the trigger event happens.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="campaign-body">Message</Label>
                    {channel === 'SMS' ? (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {body.length} chars
                        {body.length > 160 ? ' · may split' : ''}
                      </span>
                    ) : null}
                  </div>
                  <textarea
                    id="campaign-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={14}
                    placeholder={
                      channel === 'SMS'
                        ? 'Short SMS copy…'
                        : 'Write the message patrons will receive…'
                    }
                    className="border-input bg-background focus-visible:ring-ring min-h-[220px] w-full rounded-md border px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Saving…' : 'Save draft'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setListFilter(tab.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                listFilter === tab.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {filtered.length} of {campaigns.length}
        </p>
      </div>

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid items-center gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1.5fr)_100px_120px_minmax(0,1fr)_88px_auto]"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
                <Skeleton className="hidden h-4 w-20 md:block" />
                <Skeleton className="hidden h-4 w-28 md:block" />
                <Skeleton className="hidden h-4 w-10 md:block" />
                <Skeleton className="ml-auto h-8 w-20" />
              </div>
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="bg-muted mb-4 flex h-11 w-11 items-center justify-center rounded-full">
              <Megaphone className="text-muted-foreground h-5 w-5" />
            </div>
            <p className="text-sm font-medium">
              {campaigns.length === 0 ? 'No campaigns yet' : 'Nothing in this view'}
            </p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
              {campaigns.length === 0
                ? 'Create a draft, then Launch (one-time) or Enable automation.'
                : 'Switch filters or create another campaign.'}
            </p>
            {campaigns.length === 0 ? (
              <Button type="button" size="sm" className="mt-5" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New campaign
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="text-muted-foreground border-border/60 bg-muted/30 hidden border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide md:grid md:grid-cols-[minmax(0,1.5fr)_100px_120px_minmax(0,1fr)_88px_minmax(140px,auto)] md:gap-3">
            <span>Campaign</span>
            <span>Status</span>
            <span>Channel</span>
            <span>Audience</span>
            <span className="text-right">Sent</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y">
            {filtered.map((c) => {
              const manual = c.trigger === 'MANUAL';
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 px-4 py-3.5 md:grid md:grid-cols-[minmax(0,1.5fr)_100px_120px_minmax(0,1fr)_88px_minmax(140px,auto)] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {manual ? 'One-time' : 'Automation'} · {triggerLabel(c.trigger)}
                      {c.scheduledAt
                        ? ` · ${new Date(c.scheduledAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`
                        : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 md:hidden">
                      <StatusBadge status={c.status} />
                      <span className="text-muted-foreground text-xs">
                        {channelLabel(c.channel)} · {segmentLabel(c.segmentPreset)} · {c.sentCount}{' '}
                        sent
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-muted-foreground hidden text-sm md:block">
                    {channelLabel(c.channel)}
                  </div>
                  <div className="text-muted-foreground hidden truncate text-sm md:block">
                    {segmentLabel(c.segmentPreset)}
                  </div>
                  <div className="hidden text-right text-sm tabular-nums md:block">
                    {c.sentCount}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {c.status === 'draft' && !manual ? (
                      <Button
                        size="sm"
                        onClick={() => activate.mutate(c.id)}
                        disabled={activate.isPending}
                      >
                        Enable
                      </Button>
                    ) : null}
                    {c.status === 'draft' && manual ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (
                            !confirm(
                              `Launch “${c.name}” now? Messages will queue to the selected audience.`,
                            )
                          ) {
                            return;
                          }
                          launch.mutate(c.id);
                        }}
                        disabled={launch.isPending}
                      >
                        Launch
                      </Button>
                    ) : null}
                    {c.status === 'scheduled' && manual ? (
                      <span className="text-muted-foreground text-xs">Scheduled</span>
                    ) : null}
                    {c.status === 'active' && !manual ? (
                      <span className="text-muted-foreground text-xs">Running</span>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (!confirm(`Delete “${c.name}”? This cannot be undone.`)) return;
                        deleteCampaign.mutate(c.id);
                      }}
                      disabled={deleteCampaign.isPending}
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
