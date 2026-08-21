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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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

function consentLabel(value: string): string {
  return value === 'GRANTED' ? 'Opted in' : 'Not opted in';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function formatRelativeDay(iso: string | null): string {
  if (!iso) return 'No visits yet';
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
      toast.success('Patron updated');
    },
    onError: () => toast.error('Could not update patron'),
  });

  const filteredTimeline = useMemo(() => {
    if (!profile) return [];
    if (timelineFilter === 'all') return profile.timeline;
    return profile.timeline.filter((item) => item.type === timelineFilter);
  }, [profile, timelineFilter]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="bg-muted h-28 rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="bg-muted h-64 rounded-2xl lg:col-span-1" />
          <div className="bg-muted h-96 rounded-2xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-destructive text-sm">Patron not found or CRM not available.</p>
        <Link href="/patrons" className="text-primary text-sm underline">
          Back to directory
        </Link>
      </div>
    );
  }

  const notes = notesDraft ?? profile.notes;
  const satisfaction = profile.satisfaction ?? {
    reviewCount: 0,
    averageRating: null,
    latestRating: null,
  };

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

  const filterOptions: Array<{ value: typeof timelineFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'review', label: 'Reviews' },
    { value: 'ticket', label: 'Tickets' },
    { value: 'visit', label: 'Visits' },
    { value: 'appointment', label: 'Appointments' },
    { value: 'notification', label: 'Messages' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/patrons"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Patrons
        </Link>
      </div>

      <section className="from-card via-card to-muted/30 relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div
            className="bg-primary/10 text-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold tracking-tight"
            aria-hidden
          >
            {initials(profile.name)}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className={`truncate ${DASHBOARD_PAGE_HEADING_CLASS}`}>{profile.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Member since{' '}
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {profile.email ? (
                <a
                  href={`mailto:${profile.email}`}
                  className="text-foreground/90 hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <Mail className="text-muted-foreground h-4 w-4" />
                  {profile.email}
                </a>
              ) : null}
              {profile.phone ? (
                <a
                  href={`tel:${profile.phone}`}
                  className="text-foreground/90 hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <Phone className="text-muted-foreground h-4 w-4" />
                  {profile.phone}
                </a>
              ) : null}
              {!profile.email && !profile.phone ? (
                <span className="text-muted-foreground">No contact details on file</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="bg-background/80 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
                {profile.visitCount} visit{profile.visitCount === 1 ? '' : 's'}
              </span>
              <span className="bg-background/80 text-muted-foreground inline-flex items-center rounded-full border px-3 py-1 text-xs">
                Last visit · {formatRelativeDay(profile.lastVisitAt)}
              </span>
              {satisfaction.averageRating != null ? (
                <span className="bg-background/80 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
                  <StarRow rating={satisfaction.averageRating} size="sm" />
                  {satisfaction.averageRating.toFixed(1)} avg · {satisfaction.reviewCount} review
                  {satisfaction.reviewCount === 1 ? '' : 's'}
                </span>
              ) : (
                <span className="bg-background/80 text-muted-foreground inline-flex items-center rounded-full border px-3 py-1 text-xs">
                  No ratings yet
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-card rounded-2xl border p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Satisfaction</h2>
              {satisfaction.latestRating != null ? (
                <span className="text-muted-foreground text-xs">
                  Latest {satisfaction.latestRating}★
                </span>
              ) : null}
            </div>
            {satisfaction.reviewCount > 0 && satisfaction.averageRating != null ? (
              <div className="space-y-3">
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-semibold tabular-nums tracking-tight">
                    {satisfaction.averageRating.toFixed(1)}
                  </p>
                  <div className="pb-1">
                    <StarRow rating={satisfaction.averageRating} />
                    <p className="text-muted-foreground mt-1 text-xs">
                      from {satisfaction.reviewCount} approved review
                      {satisfaction.reviewCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Ratings sync from QlessQ after approval and appear here on the patron timeline.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed">
                No synced ratings yet. Approve a QlessQ review for this email to see stars and
                review history here.
              </p>
            )}
          </div>

          <div className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Consent</h2>
              {canEdit ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                  onClick={async () => {
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
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  DSAR
                </button>
              ) : null}
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Marketing SMS
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    profile.marketingSmsConsent === 'GRANTED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {consentLabel(profile.marketingSmsConsent)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Marketing email
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    profile.marketingEmailConsent === 'GRANTED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {consentLabel(profile.marketingEmailConsent)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Transactional SMS</span>
                <span className="text-xs">
                  {profile.transactionalSmsAllowed ? 'Allowed' : 'Not allowed'}
                </span>
              </div>
            </div>
            {profile.consentLedger.length > 0 ? (
              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-wider">
                  Consent history
                </p>
                <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
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
          </div>

          <div className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Tag className="h-4 w-4" />
              Tags & notes
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.tags.length === 0 ? (
                <p className="text-muted-foreground text-xs">No tags yet</p>
              ) : (
                profile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                  >
                    {tag}
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))
              )}
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add tag (VIP, interpreter…)"
                  className="border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={addTag}
                  disabled={updateMutation.isPending}
                  className="border-input rounded-md border px-3 text-sm"
                >
                  Add
                </button>
              </div>
            ) : null}
            <textarea
              value={notes}
              onChange={(e) => setNotesDraft(e.target.value)}
              readOnly={!canEdit}
              rows={4}
              placeholder="Staff notes (allergies, preferences…)"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
            {canEdit && notesDraft !== null && notesDraft !== profile.notes ? (
              <button
                type="button"
                onClick={saveNotes}
                disabled={updateMutation.isPending}
                className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm"
              >
                Save notes
              </button>
            ) : null}
          </div>

          <PatronLoyaltyPanel customerId={customerId} />
          <PatronLoyaltyProfileForm customerId={customerId} />
          <PatronTasksPanel customerId={customerId} />
        </div>

        <div className="lg:col-span-2">
          <div className="bg-card rounded-2xl border p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimelineFilter(option.value)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs transition-colors',
                      timelineFilter === option.value
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTimeline.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                {timelineFilter === 'all'
                  ? 'No activity recorded yet.'
                  : `No ${timelineFilter} activity yet.`}
              </p>
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
                          'relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
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
                            <span className="bg-muted rounded-full px-2 py-0.5 text-[11px] capitalize">
                              {item.status.replace('_', ' ')}
                            </span>
                          ) : null}
                        </div>
                        {item.subtitle ? (
                          <p className="text-muted-foreground text-sm">{item.subtitle}</p>
                        ) : null}
                        {item.type === 'review' && typeof item.meta?.comment === 'string' ? (
                          <p className="bg-muted/40 text-foreground/90 mt-2 rounded-lg px-3 py-2 text-sm leading-relaxed">
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
          </div>
        </div>
      </div>
    </div>
  );
}
