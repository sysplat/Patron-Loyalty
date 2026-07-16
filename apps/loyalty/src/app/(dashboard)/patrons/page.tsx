'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CUSTOMER_SEGMENT_PRESET_LABELS,
  CUSTOMER_SEGMENT_PRESET_VALUES,
  type CustomerSegmentPreset,
  RESOURCES,
  ACTIONS,
} from '@queueplatform/shared';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { fetchPaginated, loyaltyGet } from '@/lib/api-response';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { branchFilterAllLabel, hasPermission } from '@/lib/rbac-ui';
import { useTabVisible } from '@/lib/use-tab-visible';
import { validateCreateCustomer } from '@/lib/validation';
import { ContactRound, Search, ChevronRight, Sparkles, BookmarkPlus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface BranchOption {
  id: string;
  name: string;
}

interface CustomerListItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  tags: string[];
  marketingSmsConsent: string;
  visitCount: number;
  lastVisitAt: string | null;
  createdAt: string;
  referralCode?: string | null;
}

interface SavedSegment {
  id: string;
  name: string;
  filters: Record<string, unknown>;
}

const PRESET_OPTIONS: { value: CustomerSegmentPreset; label: string }[] =
  CUSTOMER_SEGMENT_PRESET_VALUES.map((value) => ({
    value,
    label: CUSTOMER_SEGMENT_PRESET_LABELS[value],
  }));

export default function CustomersPage() {
  const token = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = hasPermission(userRole, RESOURCES.CUSTOMER, ACTIONS.UPDATE);
  const canCreate = hasPermission(userRole, RESOURCES.CUSTOMER, ACTIONS.CREATE);
  const tabVisible = useTabVisible();

  const { data: orgProfile } = useQuery({
    queryKey: ['organization', 'profile'],
    queryFn: () => loyaltyGet<{ patronCrmEnabled?: boolean }>('/organization/profile', token!),
    enabled: !!token,
    staleTime: 60_000,
  });

  const patronCrmEnabled = orgProfile?.patronCrmEnabled === true;

  const [branchId, setBranchId] = useState('');
  const [segment, setSegment] = useState('');
  const [savedSegmentId, setSavedSegmentId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDeferredValue(searchInput.trim());
  const [page, setPage] = useState(1);
  const [saveSegmentOpen, setSaveSegmentOpen] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '' });
  const qc = useQueryClient();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-minimal'],
    queryFn: () =>
      api
        .get<{ data: BranchOption[] } | BranchOption[]>('/branches', { token: token! })
        .then((r) => (Array.isArray(r) ? r : (r.data ?? []))),
    enabled: !!token && patronCrmEnabled,
    staleTime: 60_000,
  });

  const { data: savedSegments = [] } = useQuery({
    queryKey: ['customer-segments-saved'],
    queryFn: () => api.get<SavedSegment[]>('/customers/segments', { token: token! }),
    enabled: !!token && patronCrmEnabled,
    staleTime: 30_000,
  });

  const queryKey = useMemo(
    () => ['customers', branchId, segment, savedSegmentId, search, page],
    [branchId, segment, savedSegmentId, search, page],
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (branchId) p.set('branchId', branchId);
      if (segment) p.set('segment', segment);
      if (savedSegmentId) p.set('savedSegmentId', savedSegmentId);
      if (search) p.set('search', search);
      return fetchPaginated<CustomerListItem>(`/customers?${p.toString()}`, token!);
    },
    enabled: !!token && patronCrmEnabled,
    refetchInterval: tabVisible ? 30_000 : false,
    staleTime: 15_000,
  });

  const saveSegmentMutation = useMutation({
    mutationFn: (name: string) =>
      api.post(
        '/customers/segments',
        {
          name,
          filters: {
            ...(segment ? { preset: segment } : {}),
            ...(branchId ? { branchId } : {}),
            ...(search ? { search } : {}),
          },
        },
        { token: token! },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-segments-saved'] });
      toast.success('Segment saved');
      setSaveSegmentOpen(false);
      setSegmentName('');
    },
    onError: () => toast.error('Could not save segment'),
  });

  const createPatronMutation = useMutation({
    mutationFn: (payload: { name: string; email?: string; phone?: string }) =>
      api.post('/customers', payload, { token: token! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer added');
      setCreateOpen(false);
      setCreateForm({ name: '', email: '', phone: '' });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Could not add customer';
      toast.error(message);
    },
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;
  const branchLabel = branchFilterAllLabel(userRole);

  if (orgProfile && !patronCrmEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Customers</h1>
          <p className="text-muted-foreground text-sm">
            Customer directory, visit history, and marketing segments
          </p>
        </div>
        <div className="bg-card rounded-xl border p-8 text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Sparkles className="text-primary h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Customer CRM is not enabled</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            Customer CRM must be turned on for your organization before you can use the customer
            directory, profiles, and segments. Contact your platform administrator to enable it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Customers</h1>
          <p className="text-muted-foreground text-sm">
            Search customers, view visit history, and filter by segments
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Add customer
          </button>
        ) : null}
      </div>

      {createOpen && canCreate ? (
        <form
          className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = validateCreateCustomer(createForm);
            if (!parsed.ok) {
              toast.error(parsed.error);
              return;
            }
            createPatronMutation.mutate(parsed.data);
          }}
        >
          <input
            required
            placeholder="Name"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm sm:col-span-2 lg:col-span-1"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          />
          <input
            placeholder="Phone (optional)"
            value={createForm.phone}
            onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={createPatronMutation.isPending}
              className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium disabled:opacity-50"
            >
              {createPatronMutation.isPending ? 'Saving…' : 'Save customer'}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="text-muted-foreground hover:text-foreground h-9 px-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, or phone"
            className="border-input bg-background h-9 w-full rounded-md border py-2 pl-9 pr-3 text-sm"
            autoComplete="off"
          />
        </div>
        <select
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setPage(1);
          }}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{branchLabel}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={segment}
          onChange={(e) => {
            setSegment(e.target.value);
            setSavedSegmentId('');
            setPage(1);
          }}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All customers</option>
          {PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {savedSegments.length > 0 && (
          <select
            value={savedSegmentId}
            onChange={(e) => {
              setSavedSegmentId(e.target.value);
              setSegment('');
              setPage(1);
            }}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="">Saved segments</option>
            {savedSegments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {canEdit && (segment || branchId || search) && (
          <button
            type="button"
            onClick={() => setSaveSegmentOpen((v) => !v)}
            className="border-input flex h-9 items-center gap-2 rounded-md border px-3 text-sm"
          >
            <BookmarkPlus className="h-4 w-4" />
            Save segment
          </button>
        )}
      </div>

      {saveSegmentOpen && (
        <div className="bg-card flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center">
          <input
            value={segmentName}
            onChange={(e) => setSegmentName(e.target.value)}
            placeholder="Segment name"
            className="border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => segmentName.trim() && saveSegmentMutation.mutate(segmentName.trim())}
            disabled={saveSegmentMutation.isPending}
            className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm"
          >
            Save
          </button>
        </div>
      )}

      {error ? (
        <div className="text-destructive py-12 text-center text-sm">
          Could not load customers. Try again or contact support.
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground py-12 text-center">Loading customers…</div>
      ) : customers.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">
          No customers match your filters.
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <div className="divide-y">
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`/patrons/${c.id}`}
                className="hover:bg-muted/40 flex items-center gap-4 px-4 py-3 transition-colors sm:px-5"
              >
                <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <ContactRound className="text-primary h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.marketingSmsConsent === 'GRANTED' && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        SMS opt-in
                      </span>
                    )}
                    {c.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-muted-foreground truncate text-sm">
                    {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {c.visitCount} visit{c.visitCount === 1 ? '' : 's'}
                    {c.lastVisitAt
                      ? ` · Last visit ${new Date(c.lastVisitAt).toLocaleDateString()}`
                      : ''}
                  </p>
                  {c.referralCode && (
                    <div
                      className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs"
                      onClick={(e) => {
                        e.preventDefault(); // prevent clicking the Link
                        navigator.clipboard.writeText(
                          `${window.location.origin}/refer/${c.referralCode}`,
                        );
                        toast.success('Referral link copied');
                      }}
                    >
                      <span className="bg-primary/5 text-primary hover:bg-primary/10 cursor-pointer rounded px-1.5 py-0.5 transition-colors">
                        /refer/{c.referralCode}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {meta.totalPages} ({meta.total} customers)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-input rounded-md border px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-input rounded-md border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {!canEdit && (
        <p className="text-muted-foreground text-center text-xs">
          You have read-only access to customer profiles.
        </p>
      )}
    </div>
  );
}
