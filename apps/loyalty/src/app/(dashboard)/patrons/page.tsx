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
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  ChevronRight,
  Sparkles,
  BookmarkPlus,
  UserPlus,
  Users,
  X,
  Copy,
  SearchX,
  AlertCircle,
} from 'lucide-react';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function selectClassName(className?: string) {
  return cn(
    'border-input bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  );
}

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

  const { data, isLoading, isFetching, error } = useQuery({
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
  const hasActiveFilters = Boolean(branchId || segment || savedSegmentId || search);
  const selectedBranchName = branches.find((b) => b.id === branchId)?.name;
  const selectedPresetLabel = PRESET_OPTIONS.find((o) => o.value === segment)?.label;
  const selectedSavedName = savedSegments.find((s) => s.id === savedSegmentId)?.name;

  const clearFilters = () => {
    setBranchId('');
    setSegment('');
    setSavedSegmentId('');
    setSearchInput('');
    setPage(1);
  };

  const copyReferral = (code: string) => {
    void navigator.clipboard.writeText(`${window.location.origin}/refer/${code}`);
    toast.success('Referral link copied');
  };

  if (orgProfile && !patronCrmEnabled) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Customers</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Directory, visit history, and marketing segments
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
              <Sparkles className="text-muted-foreground h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold">Customer CRM is not enabled</h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm">
              Ask your platform administrator to enable Customer CRM for directory, profiles, and
              segments.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Customers</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Find patrons, review visits, and open a profile for loyalty actions.
            {meta ? (
              <span className="text-foreground/80">
                {' '}
                · {meta.total.toLocaleString()} total
                {isFetching && !isLoading ? ' · Updating…' : ''}
              </span>
            ) : null}
          </p>
        </div>
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateOpen((v) => !v)}
            className="shrink-0"
          >
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            {createOpen ? 'Close' : 'Add customer'}
          </Button>
        ) : null}
      </div>

      {createOpen && canCreate ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New customer</CardTitle>
            <CardDescription>
              Create a profile now. Points and tiers attach after they earn or you award on Counter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  required
                  placeholder="Full name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="Optional"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">Phone</Label>
                <Input
                  id="create-phone"
                  placeholder="Optional"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={createPatronMutation.isPending}>
                  {createPatronMutation.isPending ? 'Saving…' : 'Save customer'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="customer-search" className="text-muted-foreground text-xs">
                Search
              </Label>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="customer-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Name, email, or phone"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-branch" className="text-muted-foreground text-xs">
                Branch
              </Label>
              <select
                id="customer-branch"
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setPage(1);
                }}
                className={selectClassName()}
              >
                <option value="">{branchLabel}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-segment" className="text-muted-foreground text-xs">
                Segment
              </Label>
              <select
                id="customer-segment"
                value={savedSegmentId ? `saved:${savedSegmentId}` : segment || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setPage(1);
                  if (value.startsWith('saved:')) {
                    setSavedSegmentId(value.slice(6));
                    setSegment('');
                    return;
                  }
                  setSavedSegmentId('');
                  setSegment(value);
                }}
                className={selectClassName()}
              >
                <option value="">All customers</option>
                <optgroup label="Presets">
                  {PRESET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
                {savedSegments.length > 0 ? (
                  <optgroup label="Saved">
                    {savedSegments.map((s) => (
                      <option key={s.id} value={`saved:${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {canEdit && hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10"
                  onClick={() => setSaveSegmentOpen((v) => !v)}
                >
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  Save segment
                </Button>
              ) : null}
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10"
                  onClick={clearFilters}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="border-border/70 flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Active
              </span>
              {search ? (
                <Badge variant="secondary" className="font-normal">
                  Search: {search}
                </Badge>
              ) : null}
              {selectedBranchName ? (
                <Badge variant="secondary" className="font-normal">
                  Branch: {selectedBranchName}
                </Badge>
              ) : null}
              {selectedPresetLabel ? (
                <Badge variant="secondary" className="font-normal">
                  {selectedPresetLabel}
                </Badge>
              ) : null}
              {selectedSavedName ? (
                <Badge variant="secondary" className="font-normal">
                  Saved: {selectedSavedName}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {saveSegmentOpen ? (
            <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
              <Input
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                placeholder="Name this segment"
                className="bg-background flex-1"
                aria-label="Segment name"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => segmentName.trim() && saveSegmentMutation.mutate(segmentName.trim())}
                disabled={saveSegmentMutation.isPending || !segmentName.trim()}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSaveSegmentOpen(false)}
              >
                Cancel
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <div className="bg-destructive/10 mb-4 flex h-11 w-11 items-center justify-center rounded-full">
              <AlertCircle className="text-destructive h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Could not load customers</p>
            <p className="text-muted-foreground mt-1 text-sm">Try again or contact support.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-border/60 hidden border-b px-4 py-3 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_88px_120px_100px_40px] md:gap-4">
            {['Customer', 'Contact', 'Visits', 'Last visit', 'SMS', ''].map((h) => (
              <Skeleton key={h || 'a'} className="h-3 w-16" />
            ))}
          </div>
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_88px_120px_100px_40px] md:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="w-full space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24 md:hidden" />
                  </div>
                </div>
                <Skeleton className="hidden h-4 w-40 md:block" />
                <Skeleton className="hidden h-4 w-10 md:block" />
                <Skeleton className="hidden h-4 w-20 md:block" />
                <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
                <Skeleton className="ml-auto h-4 w-4 md:ml-0" />
              </div>
            ))}
          </div>
        </Card>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
              {hasActiveFilters ? (
                <SearchX className="text-muted-foreground h-5 w-5" />
              ) : (
                <Users className="text-muted-foreground h-5 w-5" />
              )}
            </div>
            <p className="text-base font-medium">
              {hasActiveFilters ? 'No customers match' : 'No customers yet'}
            </p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
              {hasActiveFilters
                ? 'Clear filters or try a different search.'
                : 'Add a customer here, or enroll them from Counter with a phone lookup.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {hasActiveFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
              {canCreate && !createOpen ? (
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add customer
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/lookup">Open Counter</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="text-muted-foreground border-border/60 bg-muted/30 hidden border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_88px_120px_100px_40px] md:gap-4">
            <span>Customer</span>
            <span>Contact</span>
            <span className="text-right">Visits</span>
            <span>Last visit</span>
            <span>SMS</span>
            <span className="sr-only">Open</span>
          </div>
          <ul className="divide-y">
            {customers.map((c) => {
              const contact = [c.phone, c.email].filter(Boolean).join(' · ') || 'No contact';
              return (
                <li key={c.id}>
                  <Link
                    href={`/patrons/${c.id}`}
                    className="hover:bg-muted/50 focus-visible:bg-muted/50 group flex items-center gap-3 px-4 py-3.5 transition-colors focus-visible:outline-none md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_88px_120px_100px_40px] md:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide"
                        aria-hidden
                      >
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-foreground truncate font-medium">{c.name}</span>
                          {c.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="hidden max-w-[7rem] truncate font-normal sm:inline-flex"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-muted-foreground mt-0.5 truncate text-sm md:hidden">
                          {contact}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs md:hidden">
                          {c.visitCount} visit{c.visitCount === 1 ? '' : 's'}
                          {c.lastVisitAt ? ` · ${formatShortDate(c.lastVisitAt)}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="hidden min-w-0 md:block">
                      <p className="text-muted-foreground truncate text-sm">{contact}</p>
                      {c.referralCode ? (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyReferral(c.referralCode!);
                          }}
                        >
                          <Copy className="h-3 w-3" aria-hidden />
                          Copy referral
                        </button>
                      ) : null}
                    </div>

                    <div className="text-foreground hidden text-sm tabular-nums md:block md:text-right">
                      {c.visitCount}
                    </div>
                    <div className="text-muted-foreground hidden text-sm md:block">
                      {formatShortDate(c.lastVisitAt)}
                    </div>
                    <div className="hidden md:block">
                      {c.marketingSmsConsent === 'GRANTED' ? (
                        <Badge
                          variant="secondary"
                          className="border-transparent bg-emerald-500/10 font-normal text-emerald-800 dark:text-emerald-300"
                        >
                          Opted in
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                    <ChevronRight className="text-muted-foreground ml-auto h-4 w-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-100 md:ml-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {meta.totalPages}
            <span className="hidden sm:inline"> · {meta.total.toLocaleString()} customers</span>
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {!canEdit ? (
        <p className="text-muted-foreground text-center text-xs">
          You have read-only access to customer profiles.
        </p>
      ) : null}
    </div>
  );
}
