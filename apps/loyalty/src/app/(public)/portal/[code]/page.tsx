'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { PatronLegalModal } from '@/components/legal/patron-legal-modal';
import { hasStoredPatronConsent, storePatronConsent } from '@/lib/patron-legal-consent';

interface PortalData {
  found: boolean;
  patronName?: string;
  orgName?: string;
  pointsCurrencyName?: string;
  pointsBalance?: number;
  lifetimePointsEarned?: number;
  totalVisits?: number;
  tier?: { name: string; color?: string | null } | null;
  referralCode?: string;
  birthday?: string | null;
  badges?: Array<{ id: string; name: string; description?: string | null; earnedAt: string }>;
  challenges?: Array<{
    id: string;
    name: string;
    progress: number;
    targetValue: number;
    completedAt?: string | null;
    rewardPoints: number;
  }>;
  rewards?: Array<{
    id: string;
    name: string;
    description?: string | null;
    pointsCost: number;
  }>;
  recentActivity?: Array<{
    id: string;
    type: string;
    points: number;
    description?: string | null;
    createdAt: string;
  }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function fetchPortal(code: string): Promise<PortalData> {
  const res = await fetch(`${API_BASE}/loyalty/public/portal/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { found: false };
  return res.json() as Promise<PortalData>;
}

async function portalPost(code: string, path: string, body: object) {
  const res = await fetch(`${API_BASE}/loyalty/public/portal/${encodeURIComponent(code)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

async function portalPatch(code: string, path: string, body: object) {
  const res = await fetch(`${API_BASE}/loyalty/public/portal/${encodeURIComponent(code)}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

export default function PatronPortalPage() {
  const params = useParams();
  const code = String(params.code ?? '').toUpperCase();
  const qc = useQueryClient();
  const [birthday, setBirthday] = useState('');
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    if (code && hasStoredPatronConsent(code)) {
      setAcceptLegal(true);
    }
  }, [code]);

  const ensurePatronConsent = () => {
    if (!acceptLegal) {
      toast.error('Please accept the Loyalty Program Terms and Privacy Notice first');
      return false;
    }
    storePatronConsent(code);
    return true;
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patron-portal', code],
    queryFn: () => fetchPortal(code),
    enabled: !!code,
  });

  const redeem = useMutation({
    mutationFn: (rewardId: string) => portalPost(code, '/redeem', { rewardId }),
    onSuccess: () => {
      toast.success('Reward redeemed!');
      qc.invalidateQueries({ queryKey: ['patron-portal', code] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProfile = useMutation({
    mutationFn: () => portalPatch(code, '/profile', { birthday: birthday || null }),
    onSuccess: () => {
      storePatronConsent(code);
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['patron-portal', code] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSaveProfile = () => {
    if (!ensurePatronConsent()) return;
    saveProfile.mutate();
  };

  const handleRedeem = (rewardId: string) => {
    if (!ensurePatronConsent()) return;
    redeem.mutate(rewardId);
  };

  const handleAcceptLegal = (checked: boolean) => {
    setAcceptLegal(checked);
    if (checked) storePatronConsent(code);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-white/70">Loading your loyalty account…</p>
      </div>
    );
  }

  if (isError || !data?.found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-950 px-6 text-center text-white">
        <h1 className="text-lg font-semibold">Account not found</h1>
        <p className="text-sm text-white/70">This loyalty link is invalid or inactive.</p>
      </div>
    );
  }

  const currency = data.pointsCurrencyName ?? 'Points';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {legalModal && <PatronLegalModal type={legalModal} onClose={() => setLegalModal(null)} />}
      <div className="mx-auto max-w-lg px-4 py-8">
        <header className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-white/50">
            {data.orgName}
          </p>
          <h1 className="mt-2 text-2xl font-bold">{data.patronName}</h1>
          <p className="mt-1 text-sm text-white/70">{data.tier?.name ?? 'Member'}</p>
        </header>

        <section className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="text-white/90">
            This loyalty portal may collect optional profile information (such as birthday) and
            process your points activity separately from queue check-in. Review how your data is
            used before redeeming rewards or saving your profile.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={acceptLegal}
              onChange={(e) => handleAcceptLegal(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-white/80">
              I agree to the{' '}
              <button
                type="button"
                className="text-emerald-300 underline"
                onClick={() => setLegalModal('terms')}
              >
                Loyalty Program Terms
              </button>{' '}
              and{' '}
              <button
                type="button"
                className="text-emerald-300 underline"
                onClick={() => setLegalModal('privacy')}
              >
                Privacy Notice
              </button>
              .
            </span>
          </label>
        </section>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
          <p className="text-xs uppercase tracking-wide text-white/60">{currency} balance</p>
          <p className="mt-1 text-5xl font-bold">{data.pointsBalance ?? 0}</p>
          <p className="mt-2 text-xs text-white/50">
            {data.lifetimePointsEarned ?? 0} lifetime · {data.totalVisits ?? 0} visits
          </p>
          <p className="mt-4 font-mono text-sm tracking-widest">{data.referralCode}</p>
        </section>

        <section className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold">Your profile</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-white/60">
              Birthday (for birthday rewards)
              <input
                type="date"
                defaultValue={data.birthday?.slice(0, 10) ?? ''}
                onChange={(e) => setBirthday(e.target.value)}
                className="rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saveProfile.isPending || !acceptLegal}
              className="rounded-md bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </section>

        {data.badges && data.badges.length > 0 && (
          <section className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-sm font-semibold">Badges</h2>
            <div className="flex flex-wrap gap-2">
              {data.badges.map((badge) => (
                <span
                  key={badge.id}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs"
                  title={badge.description ?? undefined}
                >
                  {badge.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {data.challenges && data.challenges.length > 0 && (
          <section className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-sm font-semibold">Challenges</h2>
            <ul className="space-y-3">
              {data.challenges.map((challenge) => (
                <li key={challenge.id} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{challenge.name}</span>
                    <span className="text-white/60">
                      {challenge.completedAt
                        ? 'Complete'
                        : `${challenge.progress}/${challenge.targetValue}`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{
                        width: `${Math.min(100, (challenge.progress / challenge.targetValue) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.rewards && data.rewards.length > 0 && (
          <section className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-sm font-semibold">Rewards catalog</h2>
            <ul className="space-y-3">
              {data.rewards.map((reward) => {
                const canAfford = (data.pointsBalance ?? 0) >= reward.pointsCost;
                return (
                  <li key={reward.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{reward.name}</p>
                      {reward.description && <p className="text-white/60">{reward.description}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-emerald-300">{reward.pointsCost} pts</span>
                      <button
                        type="button"
                        disabled={!canAfford || redeem.isPending || !acceptLegal}
                        onClick={() => handleRedeem(reward.id)}
                        className="rounded bg-emerald-600 px-2 py-0.5 text-xs disabled:opacity-40"
                      >
                        Redeem
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {data.recentActivity && data.recentActivity.length > 0 && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
            <ul className="space-y-2 text-xs text-white/70">
              {data.recentActivity.map((row) => (
                <li key={row.id} className="flex justify-between gap-2">
                  <span>
                    {row.type} {row.points > 0 ? `+${row.points}` : row.points}
                    {row.description ? ` · ${row.description}` : ''}
                  </span>
                  <span className="shrink-0">{new Date(row.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-white/40">
          <Link href={`/card/${code}`} className="underline">
            Compact card view
          </Link>
          {' · '}
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
