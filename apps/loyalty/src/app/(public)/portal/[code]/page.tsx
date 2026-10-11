'use client';

export const runtime = 'edge';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { PatronLegalModal } from '@/components/legal/patron-legal-modal';
import { ReferralQr } from '@/components/referral-qr';
import {
  PatronBalance,
  PatronBanner,
  PatronBrandHeader,
  PatronButton,
  PatronCard,
  PatronCheckbox,
  PatronChip,
  PatronContainer,
  PatronErrorScreen,
  PatronField,
  PatronFooterLinks,
  PatronInlineLink,
  PatronInput,
  PatronLoadingScreen,
  PatronProgress,
  PatronRow,
  PatronRowList,
  PatronSection,
  PatronShell,
  PatronStampGrid,
  resolvePatronBranding,
} from '@/components/patron';
import { buildReferralInviteUrl } from '@/lib/patron-urls';
import {
  hasStoredPatronConsent,
  recordPatronLegalConsentOnServer,
  storePatronConsent,
} from '@/lib/patron-legal-consent';
import { useOnlineStatus } from '@/hooks/use-online-status';
import type { LoyaltyPublicBranding } from '@queueplatform/shared';

interface PortalData {
  found: boolean;
  legalConsentGranted?: boolean;
  patronName?: string;
  orgName?: string;
  branding?: LoyaltyPublicBranding;
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
    type: string;
  }>;
  recentActivity?: Array<{
    id: string;
    type: string;
    points: number;
    description?: string | null;
    createdAt: string;
  }>;
  stampCard?: { target: number; filled: number; totalVisits: number };
  wallet?: {
    balanceCents: number;
    currency: string;
    transactions: Array<{
      id: string;
      type: string;
      amountCents: number;
      balanceAfter: number;
      description?: string | null;
      createdAt: string;
    }>;
  } | null;
  gameStatus?: Record<string, { canPlay: boolean; nextEligibleAt: string | null }> | null;
  nextBestOffer?: { id: string; name: string; pointsCost: number } | null;
  orgSlug?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const PORTAL_TOKEN_KEY = (code: string) => `loyalty-portal-token:${code}`;
const GAME_LABELS: Record<'spin_wheel' | 'scratch_card', string> = {
  spin_wheel: 'Spin wheel',
  scratch_card: 'Scratch card',
};

function humanizeType(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatCurrencyCents(cents: number): string {
  return `${cents < 0 ? '-' : ''}$${Math.abs(cents / 100).toFixed(2)}`;
}

async function fetchPortal(code: string): Promise<PortalData> {
  const res = await fetch(`${API_BASE}/loyalty/public/portal/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { found: false };
  return res.json() as Promise<PortalData>;
}

function getPortalToken(code: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PORTAL_TOKEN_KEY(code));
}

function setPortalToken(code: string, token: string) {
  sessionStorage.setItem(PORTAL_TOKEN_KEY(code), token);
}

async function portalPost(code: string, path: string, body: object, requireAuth = false) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (requireAuth) {
    const token = getPortalToken(code);
    if (!token) throw new Error('Verify your phone to continue');
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/loyalty/public/portal/${encodeURIComponent(code)}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(err.message) ? err.message.join(', ') : err.message;
    throw new Error(message ?? 'Request failed');
  }
  return res.json();
}

async function portalPatch(code: string, path: string, body: object) {
  const token = getPortalToken(code);
  if (!token) throw new Error('Verify your phone to continue');
  const res = await fetch(`${API_BASE}/loyalty/public/portal/${encodeURIComponent(code)}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(err.message) ? err.message.join(', ') : err.message;
    throw new Error(message ?? 'Request failed');
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
  const [portalUnlocked, setPortalUnlocked] = useState(false);
  const [otp, setOtp] = useState('');
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    setPortalUnlocked(Boolean(getPortalToken(code)));
  }, [code]);

  const ensurePatronConsent = async (): Promise<boolean> => {
    if (!acceptLegal) {
      toast.error('Please accept the Loyalty Program Terms and Privacy Notice first');
      return false;
    }
    const recorded = await recordPatronLegalConsentOnServer(code);
    if (!recorded) {
      toast.error('Could not save your consent. Please try again.');
      return false;
    }
    return true;
  };

  const ensurePortalSession = async (): Promise<boolean> => {
    if (!(await ensurePatronConsent())) return false;
    if (getPortalToken(code)) return true;
    toast.error('Verify your phone first to unlock redeem and games');
    return false;
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patron-portal', code],
    queryFn: () => fetchPortal(code),
    enabled: !!code,
  });

  useEffect(() => {
    if (data?.legalConsentGranted) {
      setAcceptLegal(true);
      storePatronConsent(code);
      return;
    }
    if (code && hasStoredPatronConsent(code)) {
      setAcceptLegal(true);
    }
  }, [data?.legalConsentGranted, code]);

  const requestOtp = useMutation({
    mutationFn: () => portalPost(code, '/otp/request', {}),
    onSuccess: (result: { phoneMasked: string }) => {
      setPhoneMasked(result.phoneMasked);
      toast.success(`Code sent to ${result.phoneMasked}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyOtp = useMutation({
    mutationFn: () => portalPost(code, '/otp/verify', { otp }),
    onSuccess: (result: { accessToken: string }) => {
      setPortalToken(code, result.accessToken);
      setPortalUnlocked(true);
      setOtp('');
      toast.success('Phone verified — portal unlocked');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const redeem = useMutation({
    mutationFn: (rewardId: string) => portalPost(code, '/redeem', { rewardId }, true),
    onSuccess: () => {
      toast.success('Reward redeemed!');
      qc.invalidateQueries({ queryKey: ['patron-portal', code] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProfile = useMutation({
    mutationFn: () => portalPatch(code, '/profile', { birthday: birthday || null }),
    onSuccess: () => {
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['patron-portal', code] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const playGame = useMutation({
    mutationFn: (gameType: 'spin_wheel' | 'scratch_card') =>
      portalPost(code, '/play', { gameType }, true),
    onSuccess: (result: { resultLabel: string; pointsAwarded: number }) => {
      toast.success(
        `${result.resultLabel}${result.pointsAwarded ? ` (+${result.pointsAwarded} pts)` : ''}`,
      );
      qc.invalidateQueries({ queryKey: ['patron-portal', code] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: branchData } = useQuery({
    queryKey: ['patron-branches', data?.orgSlug],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/loyalty/public/branches/${encodeURIComponent(data!.orgSlug!)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return { found: false as const, branches: [] };
      return res.json() as Promise<{
        found: boolean;
        branches: Array<{
          id: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          lat?: number | null;
          lng?: number | null;
        }>;
      }>;
    },
    enabled: !!data?.orgSlug,
  });

  const handleSaveProfile = async () => {
    if (!(await ensurePortalSession())) return;
    saveProfile.mutate();
  };

  const handleRedeem = async (rewardId: string) => {
    if (!(await ensurePortalSession())) return;
    redeem.mutate(rewardId);
  };

  const handlePlayGame = async (gameType: 'spin_wheel' | 'scratch_card') => {
    if (!(await ensurePortalSession())) return;
    playGame.mutate(gameType);
  };

  const handleAcceptLegal = async (checked: boolean) => {
    setAcceptLegal(checked);
    if (!checked) return;
    const recorded = await recordPatronLegalConsentOnServer(code);
    if (!recorded) {
      setAcceptLegal(false);
      toast.error('Could not save your consent. Please try again.');
    }
  };

  const handleRequestOtp = async () => {
    if (!(await ensurePatronConsent())) return;
    requestOtp.mutate();
  };

  if (isLoading) {
    return <PatronLoadingScreen message="Loading your loyalty account…" />;
  }

  if (isError || !data?.found) {
    return (
      <PatronErrorScreen
        title="Account not found"
        description="This loyalty link is invalid or inactive."
      />
    );
  }

  const branding = resolvePatronBranding(data);
  const currency = branding.pointsCurrencyName;
  const tierColor = data.tier?.color?.trim() || undefined;
  const inviteUrl = data.referralCode ? buildReferralInviteUrl(data.referralCode) : null;

  return (
    <PatronShell
      branding={branding}
      banner={
        online ? null : (
          <PatronBanner>
            You appear to be offline. Redeem and profile changes will retry when connection returns.
          </PatronBanner>
        )
      }
    >
      {legalModal && (
        <PatronLegalModal
          type={legalModal}
          onClose={() => setLegalModal(null)}
          branding={branding}
        />
      )}
      <PatronContainer>
        <PatronBrandHeader
          branding={branding}
          title={data.patronName}
          subtitle={
            <span style={tierColor ? { color: tierColor } : undefined}>
              {data.tier?.name ?? 'Member'}
            </span>
          }
        />

        <PatronSection tone="warning">
          <PatronCheckbox checked={acceptLegal} onCheckedChange={handleAcceptLegal}>
            I agree to the{' '}
            <PatronInlineLink onClick={() => setLegalModal('terms')}>
              Loyalty Program Terms
            </PatronInlineLink>{' '}
            and{' '}
            <PatronInlineLink onClick={() => setLegalModal('privacy')}>
              Privacy Notice
            </PatronInlineLink>
            .
          </PatronCheckbox>
        </PatronSection>

        <PatronSection
          tone="info"
          title={portalUnlocked ? 'Phone verified' : 'Verify phone to redeem & play'}
          description={
            portalUnlocked
              ? 'This session stays unlocked in this browser tab for about 30 minutes.'
              : phoneMasked
                ? `Enter the 6-digit code sent to ${phoneMasked}.`
                : 'We text a one-time code to the phone on your loyalty account.'
          }
        >
          {!portalUnlocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <PatronButton
                size="sm"
                variant="secondary"
                loading={requestOtp.isPending}
                onClick={() => void handleRequestOtp()}
              >
                {requestOtp.isPending ? 'Sending…' : 'Send code'}
              </PatronButton>
              <PatronInput
                className="w-32"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-label="One-time code"
                placeholder="6-digit code"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <PatronButton
                size="sm"
                disabled={otp.length !== 6}
                loading={verifyOtp.isPending}
                onClick={() => verifyOtp.mutate()}
              >
                {verifyOtp.isPending ? 'Checking…' : 'Verify'}
              </PatronButton>
            </div>
          ) : null}
        </PatronSection>

        <PatronCard className="p-6">
          <PatronBalance
            label={`${currency} balance`}
            value={data.pointsBalance ?? 0}
            meta={`${data.lifetimePointsEarned ?? 0} lifetime · ${data.totalVisits ?? 0} visits`}
            code={data.referralCode}
            footnote={
              data.wallet
                ? `Wallet: ${formatCurrencyCents(data.wallet.balanceCents)} ${data.wallet.currency}`
                : undefined
            }
          />
        </PatronCard>

        {data.nextBestOffer && (
          <PatronSection tone="brand" title="Recommended for you">
            <p className="text-sm text-white/85">
              {data.nextBestOffer.name} — {data.nextBestOffer.pointsCost} pts
            </p>
          </PatronSection>
        )}

        {data.rewards && data.rewards.length > 0 && (
          <PatronSection
            title="Rewards catalog"
            description={`Redeem your ${currency.toLowerCase()} for these rewards.`}
          >
            <PatronRowList>
              {data.rewards.map((reward) => {
                const canAfford = (data.pointsBalance ?? 0) >= reward.pointsCost;
                return (
                  <PatronRow
                    key={reward.id}
                    primary={reward.name}
                    secondary={reward.description ?? undefined}
                    trailing={
                      <span className="font-medium" style={{ color: 'var(--patron-primary)' }}>
                        {reward.pointsCost} pts
                      </span>
                    }
                    trailingMeta={
                      <PatronButton
                        size="sm"
                        disabled={!canAfford || !acceptLegal}
                        loading={redeem.isPending}
                        onClick={() => void handleRedeem(reward.id)}
                      >
                        Redeem
                      </PatronButton>
                    }
                  />
                );
              })}
            </PatronRowList>
          </PatronSection>
        )}

        {data.stampCard && (
          <PatronSection
            title="Visit stamp card"
            description={`Collect ${data.stampCard.target} visits for a reward cycle · ${data.stampCard.totalVisits} total visits`}
          >
            <PatronStampGrid filled={data.stampCard.filled} target={data.stampCard.target} />
          </PatronSection>
        )}

        {data.challenges && data.challenges.length > 0 && (
          <PatronSection title="Challenges">
            <ul className="space-y-3">
              {data.challenges.map((challenge) => (
                <li key={challenge.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-white/90">{challenge.name}</span>
                    <span className="shrink-0 text-xs text-white/55">
                      {challenge.completedAt
                        ? 'Complete'
                        : `${challenge.progress}/${challenge.targetValue}`}
                    </span>
                  </div>
                  <PatronProgress
                    value={challenge.progress}
                    max={challenge.targetValue}
                    label={challenge.name}
                  />
                </li>
              ))}
            </ul>
          </PatronSection>
        )}

        {data.gameStatus && (
          <PatronSection title="Games" description="Play for bonus points once per eligible day.">
            <div className="flex flex-wrap gap-2">
              {(['spin_wheel', 'scratch_card'] as const).map((gameType) => {
                const status = data.gameStatus?.[gameType];
                return (
                  <PatronButton
                    key={gameType}
                    variant="secondary"
                    size="sm"
                    disabled={!status?.canPlay || playGame.isPending || !acceptLegal}
                    onClick={() => void handlePlayGame(gameType)}
                  >
                    {GAME_LABELS[gameType]}
                    {!status?.canPlay && status?.nextEligibleAt
                      ? ` · ${formatDate(status.nextEligibleAt)}`
                      : ''}
                  </PatronButton>
                );
              })}
            </div>
          </PatronSection>
        )}

        {data.badges && data.badges.length > 0 && (
          <PatronSection title="Badges">
            <div className="flex flex-wrap gap-2">
              {data.badges.map((badge) => (
                <PatronChip key={badge.id} title={badge.description ?? undefined}>
                  {badge.name}
                </PatronChip>
              ))}
            </div>
          </PatronSection>
        )}

        {inviteUrl && (
          <PatronSection
            title="Invite friends"
            description="Share your link or QR code — you both earn bonus points when they join."
          >
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <ReferralQr value={inviteUrl} size={112} />
              <p className="min-w-0 flex-1 break-all rounded-lg bg-black/25 p-2.5 font-mono text-xs text-white/75">
                {inviteUrl}
              </p>
            </div>
          </PatronSection>
        )}

        <PatronSection
          title="Your profile"
          description="Add your birthday to unlock birthday rewards."
        >
          <div className="flex flex-wrap items-end gap-3">
            <PatronField label="Birthday" className="min-w-[10rem]">
              {(field) => (
                <PatronInput
                  {...field}
                  type="date"
                  defaultValue={data.birthday?.slice(0, 10) ?? ''}
                  onChange={(event) => setBirthday(event.target.value)}
                />
              )}
            </PatronField>
            <PatronButton
              variant="secondary"
              disabled={!acceptLegal}
              loading={saveProfile.isPending}
              onClick={() => void handleSaveProfile()}
            >
              Save
            </PatronButton>
          </div>
        </PatronSection>

        {data.wallet?.transactions && data.wallet.transactions.length > 0 && (
          <PatronSection title="Wallet activity">
            <PatronRowList>
              {data.wallet.transactions.map((tx) => (
                <PatronRow
                  key={tx.id}
                  primary={`${humanizeType(tx.type)} ${tx.amountCents >= 0 ? '+' : ''}${formatCurrencyCents(tx.amountCents)}`}
                  secondary={tx.description ?? undefined}
                  trailing={formatDate(tx.createdAt)}
                />
              ))}
            </PatronRowList>
          </PatronSection>
        )}

        {data.recentActivity && data.recentActivity.length > 0 && (
          <PatronSection title="Recent activity">
            <PatronRowList>
              {data.recentActivity.map((row) => (
                <PatronRow
                  key={row.id}
                  primary={`${humanizeType(row.type)} ${row.points > 0 ? `+${row.points}` : row.points}`}
                  secondary={row.description ?? undefined}
                  trailing={formatDate(row.createdAt)}
                />
              ))}
            </PatronRowList>
          </PatronSection>
        )}

        {branchData?.found && branchData.branches.length > 0 && (
          <PatronSection title="Store locator">
            <PatronRowList>
              {branchData.branches.map((branch) => (
                <PatronRow
                  key={branch.id}
                  primary={branch.name}
                  secondary={
                    [
                      branch.address ?? null,
                      branch.lat != null && branch.lng != null
                        ? `${branch.lat.toFixed(4)}, ${branch.lng.toFixed(4)}`
                        : null,
                      branch.phone ?? null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                />
              ))}
            </PatronRowList>
          </PatronSection>
        )}

        <PatronFooterLinks
          className="mt-3"
          links={[
            { href: `/card/${code}`, label: 'Compact card view' },
            { href: '/patron-privacy', label: 'Privacy' },
            { href: '/patron-terms', label: 'Terms' },
          ]}
        />
      </PatronContainer>
    </PatronShell>
  );
}
