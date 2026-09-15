'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RESOURCES, ACTIONS } from '@queueplatform/shared';
import { loyaltyGet } from '@/lib/api-response';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { hasPermission } from '@/lib/rbac-ui';
import { validateCreateCustomer } from '@/lib/validation';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RecordPurchaseForm } from '@/components/record-purchase-form';
import { CounterRedeemPanel } from '@/components/counter-redeem-panel';
import { AlertTriangle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface LookupResult {
  found: boolean;
  customer?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    visitCount: number;
  };
  loyaltyAccount?: {
    pointsBalance: number;
    lifetimePointsEarned: number;
    referralCode: string;
    tier?: { name: string } | null;
  } | null;
}

interface ProgramSummary {
  earnRules: Array<{
    id: string;
    eventType: string;
    points: number;
    active: boolean;
  }>;
  defaultEarnPoints?: number;
}

function PatronLookupPageContent() {
  const token = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user?.role);
  const canCreate = hasPermission(userRole, RESOURCES.CUSTOMER, ACTIONS.CREATE);
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const phoneFromUrl = (searchParams.get('phone') ?? '').trim();
  const [phoneInput, setPhoneInput] = useState(phoneFromUrl);
  const [queryPhone, setQueryPhone] = useState(phoneFromUrl.length >= 10 ? phoneFromUrl : '');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    const next = (searchParams.get('phone') ?? '').trim();
    if (!next) return;
    setPhoneInput(next);
    if (next.length >= 10) setQueryPhone(next);
  }, [searchParams]);

  const { data: program } = useQuery({
    queryKey: ['loyalty', 'program'],
    queryFn: () => loyaltyGet<ProgramSummary>('/loyalty/program', token!),
    enabled: !!token,
    staleTime: 60_000,
  });

  const hasActivePurchaseRule = (program?.earnRules ?? []).some(
    (r) => r.eventType === 'PURCHASE' && r.active,
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['loyalty', 'lookup', queryPhone],
    queryFn: () =>
      loyaltyGet<LookupResult>(
        `/loyalty/lookup/patron?phone=${encodeURIComponent(queryPhone)}`,
        token!,
      ),
    enabled: !!token && queryPhone.length >= 10,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; email?: string; phone?: string }) =>
      api.post<{ id: string; phone?: string | null }>('/customers', payload, { token: token! }),
    onSuccess: (created) => {
      toast.success('Customer added — you can award points now');
      setNewName('');
      setNewEmail('');
      const phone = (created.phone ?? queryPhone).trim();
      setPhoneInput(phone);
      setQueryPhone(phone);
      void qc.invalidateQueries({ queryKey: ['loyalty', 'lookup'] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Could not add customer';
      toast.error(message);
    },
  });

  const runLookup = () => {
    const next = phoneInput.trim();
    if (next.length >= 10) setQueryPhone(next);
  };

  const refreshLookup = () => {
    void qc.invalidateQueries({ queryKey: ['loyalty', 'lookup', queryPhone] });
  };

  const submitNewCustomer = () => {
    const parsed = validateCreateCustomer({
      name: newName,
      email: newEmail,
      phone: queryPhone || phoneInput,
    });
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    createMutation.mutate(parsed.data);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Counter</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Award points in 3 steps: <span className="text-foreground font-medium">phone</span> →{' '}
          <span className="text-foreground font-medium">sale amount</span> →{' '}
          <span className="text-foreground font-medium">Award</span>. Redeem without leaving.
        </p>
      </div>

      {program && !hasActivePurchaseRule ? (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">No active PURCHASE earn rule</p>
            <p className="text-muted-foreground text-xs dark:text-amber-100/80">
              Add a Purchase rule under Program (recommended: 1 point per $1) so Counter and POS
              award points the same way.
            </p>
            <Link href="/program" className="text-primary text-xs font-medium underline">
              Open Program →
            </Link>
          </div>
        </div>
      ) : null}

      <Card className="sticky top-16 z-10 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Find member by phone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="+1 555 123 4567"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="h-11 max-w-xs text-base"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') runLookup();
            }}
          />
          <Button
            className="h-11"
            onClick={runLookup}
            disabled={phoneInput.trim().length < 10 || isFetching}
          >
            Look up
          </Button>
        </CardContent>
      </Card>

      {queryPhone && (isLoading || isFetching) && !createMutation.isPending && (
        <p className="text-muted-foreground text-sm">Searching…</p>
      )}

      {data?.found && data.customer && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{data.customer.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                {data.customer.phone && <p>Phone: {data.customer.phone}</p>}
                {data.customer.email && <p>Email: {data.customer.email}</p>}
                <p>Visits: {data.customer.visitCount}</p>
                {data.loyaltyAccount?.tier && <p>Tier: {data.loyaltyAccount.tier.name}</p>}
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Balance</p>
                <p className="text-foreground text-3xl font-semibold tabular-nums">
                  {data.loyaltyAccount?.pointsBalance ?? 0}
                  <span className="text-muted-foreground ml-1 text-base font-medium">pts</span>
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-semibold">2. Record purchase</p>
              <RecordPurchaseForm
                customerId={data.customer.id}
                compact
                prominent
                onSuccess={refreshLookup}
              />
            </div>

            <div className="border-t pt-4">
              <p className="mb-1 text-sm font-semibold">3. Redeem (optional)</p>
              <p className="text-muted-foreground mb-3 text-xs">
                Spend points on a reward without leaving Counter.
              </p>
              <CounterRedeemPanel
                customerId={data.customer.id}
                pointsBalance={data.loyaltyAccount?.pointsBalance ?? 0}
                onRedeemed={refreshLookup}
              />
            </div>

            <div className="border-t pt-3">
              <Link
                href={`/patrons/${data.customer.id}`}
                className="text-muted-foreground text-xs underline"
              >
                Full customer profile →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {data && !data.found && queryPhone && !isLoading && !isFetching && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              New customer
            </CardTitle>
            <CardDescription>
              No match for <span className="text-foreground font-medium">{queryPhone}</span>. Add
              them here, then award points on the next step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canCreate ? (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitNewCustomer();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="counter-new-name">Name</Label>
                  <Input
                    id="counter-new-name"
                    required
                    placeholder="Full name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="counter-new-phone">Phone</Label>
                  <Input
                    id="counter-new-phone"
                    value={queryPhone}
                    readOnly
                    className="bg-muted/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="counter-new-email">Email (optional)</Label>
                  <Input
                    id="counter-new-email"
                    type="email"
                    placeholder="Optional"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" disabled={createMutation.isPending || !newName.trim()}>
                    {createMutation.isPending ? 'Adding…' : 'Add customer & continue'}
                  </Button>
                  <Button type="button" variant="ghost" asChild>
                    <Link href="/patrons">Open Customers</Link>
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  You don’t have permission to add customers. Ask an owner or admin, or open the
                  directory if you only need to browse.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/patrons">Go to Customers</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PatronLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl py-12">
          <p className="text-muted-foreground text-sm">Loading Counter…</p>
        </div>
      }
    >
      <PatronLookupPageContent />
    </Suspense>
  );
}
