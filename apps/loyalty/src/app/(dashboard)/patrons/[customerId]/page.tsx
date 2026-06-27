'use client';

import { useState } from 'react';
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

export default function CustomerProfilePage() {
  const params = useParams();
  const customerId = String(params.customerId ?? '');
  const token = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = hasPermission(userRole, RESOURCES.CUSTOMER, ACTIONS.UPDATE);
  const qc = useQueryClient();

  const [tagInput, setTagInput] = useState('');
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

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

  if (isLoading) {
    return <div className="text-muted-foreground py-12 text-center">Loading patron profile…</div>;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/patrons"
          className="text-muted-foreground hover:text-foreground rounded-lg p-2 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`truncate ${DASHBOARD_PAGE_HEADING_CLASS}`}>{profile.name}</h1>
          <p className="text-muted-foreground text-sm">
            {profile.visitCount} visit{profile.visitCount === 1 ? '' : 's'}
            {profile.lastVisitAt
              ? ` · Last visit ${new Date(profile.lastVisitAt).toLocaleString()}`
              : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-card space-y-3 rounded-xl border p-5">
            <h2 className="font-semibold">Contact</h2>
            {profile.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="text-muted-foreground h-4 w-4" />
                {profile.phone}
              </div>
            )}
            {profile.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="text-muted-foreground h-4 w-4" />
                {profile.email}
              </div>
            )}
            {!profile.phone && !profile.email && (
              <p className="text-muted-foreground text-sm">No contact details on file.</p>
            )}
          </div>

          <div className="bg-card space-y-4 rounded-xl border p-5">
            <h2 className="font-semibold">Consent</h2>
            {canEdit && (
              <button
                type="button"
                className="border-input hover:bg-muted w-full rounded-md border px-3 py-2 text-sm"
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
                    anchor.download = `patron-dsar-${customerId}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                    toast.success('DSAR export downloaded');
                  } catch {
                    toast.error('DSAR export failed');
                  }
                }}
              >
                Download DSAR export (JSON)
              </button>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Marketing SMS
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    profile.marketingSmsConsent === 'GRANTED'
                      ? 'bg-emerald-100 text-emerald-700'
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
                      ? 'bg-emerald-100 text-emerald-700'
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
            {profile.consentLedger.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                  Consent history
                </p>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
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
            )}
          </div>

          <div className="bg-card space-y-3 rounded-xl border p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Tag className="h-4 w-4" />
              Tags & notes
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                >
                  {tag}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
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
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotesDraft(e.target.value)}
              readOnly={!canEdit}
              rows={4}
              placeholder="Staff notes (allergies, preferences…)"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
            {canEdit && notesDraft !== null && notesDraft !== profile.notes && (
              <button
                type="button"
                onClick={saveNotes}
                disabled={updateMutation.isPending}
                className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm"
              >
                Save notes
              </button>
            )}
          </div>

          <PatronLoyaltyPanel customerId={customerId} />
          <PatronLoyaltyProfileForm customerId={customerId} />
          <PatronTasksPanel customerId={customerId} />
        </div>

        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border p-5">
            <h2 className="mb-4 font-semibold">Activity timeline</h2>
            {profile.timeline.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-4">
                {profile.timeline.map((item) => {
                  const Icon = TIMELINE_ICONS[item.type];
                  return (
                    <li key={`${item.type}-${item.id}`} className="flex gap-3">
                      <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="text-muted-foreground h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 border-b pb-4 last:border-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          {item.status && (
                            <span className="bg-muted rounded-full px-2 py-0.5 text-xs capitalize">
                              {item.status.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <p className="text-muted-foreground text-sm">{item.subtitle}</p>
                        )}
                        {item.type === 'review' && typeof item.meta?.comment === 'string' && (
                          <p className="text-muted-foreground mt-1 text-sm">{item.meta.comment}</p>
                        )}
                        <p className="text-muted-foreground mt-1 text-xs">
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
