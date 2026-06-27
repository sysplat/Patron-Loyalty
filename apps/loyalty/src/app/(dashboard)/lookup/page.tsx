'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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

export default function PatronLookupPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [phoneInput, setPhoneInput] = useState('');
  const [queryPhone, setQueryPhone] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['loyalty', 'lookup', queryPhone],
    queryFn: () =>
      loyaltyGet<LookupResult>(
        `/loyalty/lookup/patron?phone=${encodeURIComponent(queryPhone)}`,
        token!,
      ),
    enabled: !!token && queryPhone.length >= 10,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Patron lookup</h1>
        <p className="text-muted-foreground text-sm">
          Find a loyalty member by phone at the counter — quick points check or profile link.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search by phone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="+1 555 123 4567"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && phoneInput.trim().length >= 10) {
                setQueryPhone(phoneInput.trim());
              }
            }}
          />
          <Button
            onClick={() => setQueryPhone(phoneInput.trim())}
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
          <CardHeader>
            <CardTitle>{data.customer.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.customer.phone && <p>Phone: {data.customer.phone}</p>}
            {data.customer.email && <p>Email: {data.customer.email}</p>}
            <p>Visits: {data.customer.visitCount}</p>
            {data.loyaltyAccount ? (
              <>
                <p>
                  Balance: {data.loyaltyAccount.pointsBalance} pts · Lifetime:{' '}
                  {data.loyaltyAccount.lifetimePointsEarned}
                </p>
                {data.loyaltyAccount.tier && <p>Tier: {data.loyaltyAccount.tier.name}</p>}
                <p className="font-mono text-xs">{data.loyaltyAccount.referralCode}</p>
              </>
            ) : (
              <p className="text-muted-foreground">No loyalty account yet.</p>
            )}
            <Link
              href={`/patrons/${data.customer.id}`}
              className="text-primary mt-2 inline-block text-sm underline"
            >
              Open patron profile →
            </Link>
          </CardContent>
        </Card>
      )}

      {data && !data.found && queryPhone && !isLoading && (
        <p className="text-muted-foreground text-sm">No patron found for that phone number.</p>
      )}
    </div>
  );
}
