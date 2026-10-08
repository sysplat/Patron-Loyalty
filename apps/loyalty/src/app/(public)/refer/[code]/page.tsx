'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LoyaltyPublicBranding } from '@queueplatform/shared';
import { ReferralQr } from '@/components/referral-qr';
import {
  PatronBrandHeader,
  PatronButton,
  PatronCard,
  PatronErrorScreen,
  PatronField,
  PatronFooterLinks,
  PatronInput,
  PatronLinkButton,
  PatronLoadingScreen,
  PatronShell,
  resolvePatronBranding,
} from '@/components/patron';
import { buildPatronPortalUrl, buildReferralInviteUrl } from '@/lib/patron-urls';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface ReferralLanding {
  found: boolean;
  orgName?: string;
  branding?: LoyaltyPublicBranding;
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
      return res.json() as Promise<{
        portalCode: string | null;
        referralApplied: boolean;
        completesOnFirstPurchase?: boolean;
        referredBonusPoints?: number;
      }>;
    },
    onSuccess: (result) => {
      if (result.portalCode) setPortalCode(result.portalCode);
      toast.success(
        result.referralApplied
          ? result.completesOnFirstPurchase
            ? `You're in! Earn ${result.referredBonusPoints ?? data?.referredBonusPoints ?? 25} points on your first purchase.`
            : 'Welcome! Referral bonus applied.'
          : 'Welcome to the loyalty program!',
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <PatronLoadingScreen message="Loading invite…" />;
  }

  if (isError || !data?.found) {
    return (
      <PatronErrorScreen
        title="Invite not found"
        description="This referral link is invalid or expired."
      />
    );
  }

  const branding = resolvePatronBranding(data);
  const footerLinks = [
    { href: '/patron-privacy', label: 'Privacy' },
    { href: '/patron-terms', label: 'Terms' },
  ];

  if (portalCode) {
    return (
      <PatronShell branding={branding} center>
        <PatronCard className="w-full max-w-md text-center shadow-2xl">
          <PatronBrandHeader
            branding={branding}
            title="You're in!"
            subtitle={`Your ${branding.programName} account is ready.`}
          />
          <PatronLinkButton href={buildPatronPortalUrl(portalCode)} className="mt-6 w-full">
            Open your portal
          </PatronLinkButton>
          <PatronFooterLinks className="mt-6" links={footerLinks} />
        </PatronCard>
      </PatronShell>
    );
  }

  const inviteUrl = buildReferralInviteUrl(code);
  const canSubmit = !!name.trim() && (!!email.trim() || !!phone.trim());

  return (
    <PatronShell branding={branding} center>
      <PatronCard className="w-full max-w-md shadow-2xl">
        <PatronBrandHeader
          branding={branding}
          title={`Join ${data.referrerFirstName ?? 'the'}'s invite`}
          subtitle={`Sign up now — earn ${data.referredBonusPoints ?? 25} welcome bonus points on your first purchase.`}
        />

        <div className="mt-5 flex justify-center">
          <ReferralQr value={inviteUrl} size={120} />
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            join.mutate();
          }}
        >
          <PatronField label="Full name">
            {(field) => (
              <PatronInput
                {...field}
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </PatronField>
          <PatronField label="Email">
            {(field) => (
              <PatronInput
                {...field}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </PatronField>
          <PatronField label="Phone" hint="Email or phone is required.">
            {(field) => (
              <PatronInput
                {...field}
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            )}
          </PatronField>
          <PatronButton
            type="submit"
            className="w-full"
            disabled={!canSubmit}
            loading={join.isPending}
          >
            {join.isPending ? 'Joining…' : 'Join loyalty program'}
          </PatronButton>
        </form>

        <PatronFooterLinks className="mt-6" links={footerLinks} />
      </PatronCard>
    </PatronShell>
  );
}
