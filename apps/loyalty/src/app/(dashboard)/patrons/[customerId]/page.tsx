'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RESOURCES, ACTIONS } from '@queueplatform/shared';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { api } from '@/lib/api';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { hasPermission } from '@/lib/rbac-ui';
import {
  ArrowLeft,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Star,
  Tag,
  Ticket,
  Bell,
  Footprints,
  Download,
  AlertCircle,
  SearchX,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PatronLoyaltyPanel } from '@/components/patron-loyalty-panel';
import { PatronLoyaltyProfileForm } from '@/components/patron-loyalty-profile-form';
import { PatronTasksPanel } from '@/components/patron-tasks-panel';

interface ConsentLedgerEntry {
  id: string;
  channel: string;
  purpose: string;
  action: string;
  source: string;
  createdAt: string;
}

interface TimelineItem {
  id: string;
  type: 'ticket' | 'appointment' | 'visit' | 'review' | 'notification';
  occurredAt: string;
  title: string;
  subtitle?: string;
  status?: string;
  meta?: Record<string, unknown>;
}

interface CustomerProfile {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  tags: string[];
  notes: string;
  transactionalSmsAllowed: boolean;
  marketingSmsConsent: string;
  marketingEmailConsent: string;
  visitCount: number;
  lastVisitAt: string | null;
  createdAt: string;
  satisfaction?: {
    reviewCount: number;
    averageRating: number | null;
    latestRating: number | null;
  };
  timeline: TimelineItem[];
  consentLedger: ConsentLedgerEntry[];
}

const TIMELINE_ICONS = {
  ticket: Ticket,
  appointment: Calendar,
  visit: Footprints,
  review: Star,
  notification: Bell,
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StarRow({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const clamped = Math.min(5, Math.max(0, Math.round(rating)));
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${clamped} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            iconClass,
            star <= clamped
              ? 'fill-amber-400 text-amber-500'
              : 'text-muted-foreground/35 fill-transparent',
          )}
        />
      ))}
    </span>
  );
}

function ConsentPill({ granted }: { granted: boolean }) {
  return granted ? (
    <Badge
      variant="secondary"
      className="border-transparent bg-emerald-500/10 font-normal text-emerald-800 dark:text-emerald-300"
    >
      Opted in
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground font-normal">
      Not opted in
    </Badge>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-28" />
      <Card>
        <CardContent className="flex items-start gap-4 p-5 sm:p-6">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
          <div className="w-full space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <div className="space-y-5 lg:col-span-8">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CustomerProfilePage() {
  const params = useParams();
  const customerId = String(params.customerId ?? '');
  const token = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = hasPermission(userRole, RESOURCES.CUSTOMER, ACTIONS.UPDATE);
  const qc = useQueryClient();

  const [tagInput, setTagInput] = useState('');
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<'all' | TimelineItem['type']>('all');

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.get<CustomerProfile>(`/customers/${customerId}`, { token: token! }),
    enabled: !!token && !!customerId,
    staleTime: 10_000,
  });

  const updateMutation = useMutation({
    mutationFn: (body: { tags?: string[]; notes?: string }) =>
      api.patch(`/customers/${customerId}`, body, { token: token! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', customerId] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
    },
    onError: () => toast.error('Could not update customer'),
  });

  const filteredTimeline = useMemo(() => {
    if (!profile) return [];
    if (timelineFilter === 'all') return profile.timeline;
    return profile.timeline.filter((item) => item.type === timelineFilter);
  }, [profile, timelineFilter]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <div className="bg-destructive/10 mx-auto flex h-11 w-11 items-center justify-center rounded-full">
          <AlertCircle className="text-destructive h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Customer not found or CRM not available</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/patrons">Back to customers</Link>
        </Button>
      </div>
    );
  }

  const notes = notesDraft ?? profile.notes;
  const satisfaction = profile.satisfaction ?? {
    reviewCount: 0,
    averageRating: null,
    latestRating: null,
  };
  const notesDirty = notesDraft !== null && notesDraft !== profile.notes;
  const counterHref = profile.phone
    ? `/lookup?phone=${encodeURIComponent(profile.phone)}`
    : '/lookup';

  function addTag(): void {
    if (!profile) return;
    const next = tagInput.trim();
    if (!next || profile.tags.includes(next)) return;
    updateMutation.mutate({ tags: [...profile.tags, next], notes });
    setTagInput('');
  }

  function removeTag(tag: string): void {
    if (!profile) return;
    updateMutation.mutate({
      tags: profile.tags.filter((t) => t !== tag),
      notes,
    });
  }

  function saveNotes(): void {
    if (!profile) return;
    updateMutation.mutate({ tags: profile.tags, notes });
    setNotesDraft(null);
  }

  async function downloadDsar(): Promise<void> {
    try {
      const payload = await loyaltyGet<Record<string, unknown>>(
        `/loyalty/accounts/${customerId}/dsar-export`,
        token!,
      );
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `customer-dsar-${customerId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('DSAR export downloaded');
    } catch {
      toast.error('DSAR export failed');
    }
  }

  const filterOptions: Array<{ value: typeof timelineFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'review', label: 'Reviews' },
    { value: 'ticket', label: 'Tickets' },
    { value: 'visit', label: 'Visits' },
    { value: 'appointment', label: 'Appointments' },
    { value: 'notification', label: 'Messages' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
          <Link href="/patrons">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Customers
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void downloadDsar()}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              DSAR export
            </Button>
          ) : null}
          <Button type="button" size="sm" asChild>
            <Link href={counterHref}>
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              Open on Counter
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          <div
            className="bg-muted text-muted-foreground flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold tracking-wide"
            aria-hidden
          >
            {initials(profile.name)}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className={`truncate ${DASHBOARD_PAGE_HEADING_CLASS}`}>{profile.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Member since {formatShortDate(profile.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.email ? (
                <Button variant="outline" size="sm" className="h-8 font-normal" asChild>
                  <a href={`mailto:${profile.email}`}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {profile.email}
                  </a>
                </Button>
              ) : null}
              {profile.phone ? (
                <Button variant="outline" size="sm" className="h-8 font-normal" asChild>
                  <a href={`tel:${profile.phone}`}>
                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                    {profile.phone}
                  </a>
                </Button>
              ) : null}
              {!profile.email && !profile.phone ? (
                <span className="text-muted-foreground text-sm">No contact details on file</span>
              ) : null}
            </div>
            {profile.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Visits
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {profile.visitCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Last visit
            </p>
            <p className="mt-1 text-sm font-medium leading-snug">
              {profile.lastVisitAt ? formatDateTime(profile.lastVisitAt) : 'No visits yet'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Satisfaction
            </p>
            {satisfaction.averageRating != null ? (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {satisfaction.averageRating.toFixed(1)}
                </p>
                <div>
                  <StarRow rating={satisfaction.averageRating} size="sm" />
                  <p className="text-muted-foreground text-xs">
                    {satisfaction.reviewCount} review
                    {satisfaction.reviewCount === 1 ? '' : 's'}
                    {satisfaction.latestRating != null
                      ? ` · latest ${satisfaction.latestRating}★`
                      : ''}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1 text-sm">No ratings yet</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Marketing SMS
            </p>
            <div className="mt-2">
              <ConsentPill granted={profile.marketingSmsConsent === 'GRANTED'} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <aside className="space-y-5 lg:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Consent</CardTitle>
              <CardDescription>Marketing and transactional messaging status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground inline-flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Marketing SMS
                </span>
                <ConsentPill granted={profile.marketingSmsConsent === 'GRANTED'} />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Marketing email
                </span>
                <ConsentPill granted={profile.marketingEmailConsent === 'GRANTED'} />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Transactional SMS</span>
                <span className="text-sm font-medium">
                  {profile.transactionalSmsAllowed ? 'Allowed' : 'Not allowed'}
                </span>
              </div>
              {profile.consentLedger.length > 0 ? (
                <div className="border-border/70 border-t pt-3">
                  <p className="text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-wider">
                    History
                  </p>
                  <ul className="max-h-36 space-y-2 overflow-y-auto text-xs">
                    {profile.consentLedger.map((entry) => (
                      <li key={entry.id} className="text-muted-foreground">
                        <span className="text-foreground">
                          {entry.action} {entry.channel} ({entry.purpose})
                        </span>
                        {' · '}
                        {entry.source} · {new Date(entry.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4" />
                Tags & notes
              </CardTitle>
              <CardDescription>Staff-only context for the next visit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {profile.tags.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No tags yet</p>
                ) : (
                  profile.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 font-normal">
                      {tag}
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="text-muted-foreground hover:text-foreground ml-0.5"
                          aria-label={`Remove ${tag}`}
                        >
                          ×
                        </button>
                      ) : null}
                    </Badge>
                  ))
                )}
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add tag"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={addTag}
                    disabled={updateMutation.isPending || !tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="staff-notes" className="text-muted-foreground text-xs">
                  Notes
                </Label>
                <textarea
                  id="staff-notes"
                  value={notes}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  readOnly={!canEdit}
                  rows={4}
                  placeholder="Allergies, preferences, interpreter needs…"
                  className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
                />
              </div>
              {canEdit && notesDirty ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={saveNotes}
                  disabled={updateMutation.isPending}
                >
                  Save notes
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <PatronLoyaltyProfileForm customerId={customerId} />
          <PatronTasksPanel customerId={customerId} />
        </aside>

        <div className="space-y-5 lg:col-span-8">
          <PatronLoyaltyPanel customerId={customerId} />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Activity</CardTitle>
                  <CardDescription>Visits, reviews, tickets, and messages</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTimelineFilter(option.value)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        timelineFilter === option.value
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTimeline.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
                    <SearchX className="text-muted-foreground h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium">
                    {timelineFilter === 'all' ? 'No activity yet' : `No ${timelineFilter} activity`}
                  </p>
                  <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                    Activity appears here when visits, reviews, or messages sync for this customer.
                  </p>
                </div>
              ) : (
                <ul className="relative space-y-0">
                  {filteredTimeline.map((item, index) => {
                    const Icon = TIMELINE_ICONS[item.type];
                    const rating =
                      item.type === 'review' && typeof item.meta?.rating === 'number'
                        ? item.meta.rating
                        : null;
                    const isLast = index === filteredTimeline.length - 1;
                    return (
                      <li key={`${item.type}-${item.id}`} className="relative flex gap-3 pb-5">
                        {!isLast ? (
                          <span
                            className="bg-border absolute left-[17px] top-9 h-[calc(100%-1.25rem)] w-px"
                            aria-hidden
                          />
                        ) : null}
                        <div
                          className={cn(
                            'relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                            item.type === 'review'
                              ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40'
                              : 'bg-muted/60',
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4',
                              item.type === 'review'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground',
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.title}</span>
                            {rating != null ? <StarRow rating={rating} size="sm" /> : null}
                            {item.status ? (
                              <Badge variant="secondary" className="font-normal capitalize">
                                {item.status.replace('_', ' ')}
                              </Badge>
                            ) : null}
                          </div>
                          {item.subtitle ? (
                            <p className="text-muted-foreground text-sm">{item.subtitle}</p>
                          ) : null}
                          {item.type === 'review' && typeof item.meta?.comment === 'string' ? (
                            <p className="bg-muted/40 text-foreground/90 mt-2 rounded-md px-3 py-2 text-sm leading-relaxed">
                              “{item.meta.comment}”
                            </p>
                          ) : null}
                          <p className="text-muted-foreground mt-1.5 text-xs">
                            {new Date(item.occurredAt).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {!canEdit ? (
        <p className="text-muted-foreground text-center text-xs">
          You have read-only access to this customer.
        </p>
      ) : null}
    </div>
  );
}
