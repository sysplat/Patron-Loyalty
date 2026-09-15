'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RecordPurchaseForm } from '@/components/record-purchase-form';
import { CounterRedeemPanel } from '@/components/counter-redeem-panel';
import { AlertTriangle } from 'lucide-react';

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

export default function PatronLookupPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [phoneInput, setPhoneInput] = useState('');
  const [queryPhone, setQueryPhone] = useState('');

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

  const runLookup = () => {
    const next = phoneInput.trim();
    if (next.length >= 10) setQueryPhone(next);
  };

  const refreshLookup = () => {
    void qc.invalidateQueries({ queryKey: ['loyalty', 'lookup', queryPhone] });
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

      {queryPhone && (isLoading || isFetching) && (
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
          <CardContent className="space-y-3 pt-6 text-sm">
            <p className="font-medium">No customer found for that phone number.</p>
            <p className="text-muted-foreground text-xs">
              Check the number, or add them under Customers, then return here to award points.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/patrons">Go to Customers</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
