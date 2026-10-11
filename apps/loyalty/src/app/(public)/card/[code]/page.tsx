'use client';

export const runtime = 'edge';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { LoyaltyPublicBranding } from '@queueplatform/shared';
import { ReferralQr } from '@/components/referral-qr';
import {
  PatronBalance,
  PatronBrandHeader,
  PatronCard,
  PatronErrorScreen,
  PatronFooterLinks,
  PatronLoadingScreen,
  PatronShell,
  resolvePatronBranding,
} from '@/components/patron';
import { buildPatronPortalUrl } from '@/lib/patron-urls';

interface PublicCard {
  found: boolean;
  patronName?: string;
  orgName?: string;
  branding?: LoyaltyPublicBranding;
  pointsBalance?: number;
  tier?: { name: string; color?: string | null } | null;
  referralCode?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function fetchPublicCard(code: string): Promise<PublicCard> {
  const res = await fetch(`${API_BASE}/loyalty/public/card/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { found: false };
  return res.json() as Promise<PublicCard>;
}

export default function PublicCardPage() {
  const params = useParams();
  const code = String(params.code ?? '').toUpperCase();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-card', code],
    queryFn: () => fetchPublicCard(code),
    enabled: !!code,
  });

  if (isLoading) {
    return <PatronLoadingScreen message="Loading your card…" />;
  }

  if (isError || !data?.found) {
    return (
      <PatronErrorScreen
        title="Card not found"
        description="This loyalty card is invalid or no longer active."
      />
    );
  }

  const branding = resolvePatronBranding(data);
  const tierColor = data.tier?.color?.trim() || undefined;

  return (
    <PatronShell branding={branding} center>
      <PatronCard className="w-full max-w-sm shadow-2xl">
        <PatronBrandHeader
          branding={branding}
          title={data.patronName}
          subtitle={
            <span style={tierColor ? { color: tierColor } : undefined}>
              {data.tier?.name ?? 'Member'}
            </span>
          }
        />
        <div className="mt-6 rounded-xl bg-white/10 p-4">
          <PatronBalance
            label={`${branding.pointsCurrencyName} balance`}
            value={
              <span style={{ color: 'var(--patron-primary)' }}>{data.pointsBalance ?? 0}</span>
            }
            code={data.referralCode}
          />
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          <ReferralQr value={buildPatronPortalUrl(data.referralCode ?? code)} size={96} />
          <p className="text-center text-xs text-white/50">Scan for the full portal</p>
        </div>
        <PatronFooterLinks
          className="mt-6"
          links={[
            { href: `/portal/${data.referralCode ?? code}`, label: 'Full portal view' },
            { href: '/patron-privacy', label: 'Privacy' },
            { href: '/patron-terms', label: 'Terms' },
          ]}
        />
      </PatronCard>
    </PatronShell>
  );
}
