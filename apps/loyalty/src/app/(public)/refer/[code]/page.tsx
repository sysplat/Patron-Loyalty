'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReferralQr } from '@/components/referral-qr';
import { buildPatronPortalUrl, buildReferralInviteUrl } from '@/lib/patron-urls';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface ReferralLanding {
  found: boolean;
  orgName?: string;
  referrerFirstName?: string;
  referredBonusPoints?: number;
  referralCode?: string;
}

async function fetchLanding(code: string): Promise<ReferralLanding> {
  const res = await fetch(`${API_BASE}/loyalty/public/refer/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { found: false };
  return res.json() as Promise<ReferralLanding>;
}

export default function PublicReferJoinPage() {
  const params = useParams();
  const code = String(params.code ?? '').toUpperCase();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [portalCode, setPortalCode] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['refer-landing', code],
    queryFn: () => fetchLanding(code),
    enabled: !!code,
  });

  const join = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/loyalty/public/refer/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? 'Could not join');
      }
      return res.json() as Promise<{ portalCode: string | null; referralApplied: boolean }>;
    },
    onSuccess: (result) => {
      if (result.portalCode) setPortalCode(result.portalCode);
      toast.success(
        result.referralApplied
          ? 'Welcome! Referral bonus applied.'
          : 'Welcome to the loyalty program!',
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading invite…</p>
      </div>
    );
  }

  if (isError || !data?.found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold">Invite not found</h1>
        <p className="text-muted-foreground text-sm">This referral link is invalid or expired.</p>
      </div>
    );
  }

  if (portalCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white">
          <h1 className="text-xl font-bold">You&apos;re in!</h1>
          <p className="mt-2 text-sm text-white/70">
            Your {data.orgName} loyalty account is ready.
          </p>
          <Link
            href={buildPatronPortalUrl(portalCode)}
            className="mt-6 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Open your portal
          </Link>
        </div>
      </div>
    );
  }

  const inviteUrl = buildReferralInviteUrl(code);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-widest text-white/60">{data.orgName}</p>
        <h1 className="mt-2 text-2xl font-bold">Join {data.referrerFirstName}&apos;s invite</h1>
        <p className="mt-2 text-sm text-white/70">
          Sign up and earn {data.referredBonusPoints ?? 25} welcome bonus points.
        </p>

        <div className="mt-4 flex justify-center">
          <ReferralQr value={inviteUrl} size={120} />
        </div>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            join.mutate();
          }}
        >
          <label className="block text-xs text-white/60">
            Full name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/60">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/60">
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            />
          </label>
          <p className="text-xs text-white/50">Email or phone is required.</p>
          <button
            type="submit"
            disabled={join.isPending || !name.trim() || (!email.trim() && !phone.trim())}
            className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            {join.isPending ? 'Joining…' : 'Join loyalty program'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">
          <Link href="/patron-privacy" className="underline">
            Privacy
          </Link>
          {' · '}
          <Link href="/patron-terms" className="underline">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
