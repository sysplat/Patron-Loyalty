'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

interface PublicCard {
  found: boolean;
  patronName?: string;
  orgName?: string;
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading card…</p>
      </div>
    );
  }

  if (isError || !data?.found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold">Card not found</h1>
        <p className="text-muted-foreground text-sm">
          This loyalty card is invalid or no longer active.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-widest text-white/60">
          {data.orgName}
        </p>
        <h1 className="mt-2 text-2xl font-bold">{data.patronName}</h1>
        <p className="mt-1 text-sm text-white/70">{data.tier?.name ?? 'Member'}</p>
        <div className="mt-6 rounded-xl bg-white/10 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-white/60">Points balance</p>
          <p className="text-4xl font-bold">{data.pointsBalance ?? 0}</p>
        </div>
        <p className="mt-6 text-center font-mono text-sm tracking-widest">{data.referralCode}</p>
        <p className="mt-6 text-center text-xs text-white/40">
          <Link href={`/portal/${data.referralCode}`} className="underline">
            Full portal view
          </Link>
          {' · '}
          <Link href="/patron-privacy" className="underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
