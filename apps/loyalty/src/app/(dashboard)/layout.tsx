'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { syncAccessTokenFromBff } from '@/lib/sync-access-token-from-bff';
import { LoyaltyBootShell, LoyaltyDashboardShell } from '@/components/loyalty-dashboard-shell';
import { LoyaltyActivationGate } from '@/components/loyalty-activation-gate';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [hydrated, setHydrated] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(() =>
    typeof window !== 'undefined' ? useAuthStore.persist.hasHydrated() : false,
  );
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthHydrated(true);
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setAuthHydrated(true));
    const fallback = window.setTimeout(() => setAuthHydrated(true), 2500);
    return () => {
      unsub();
      window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !authHydrated || token || sessionChecked) return;
    let cancelled = false;
    (async () => {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        const refreshPayload = (await refreshRes.json().catch(() => null)) as {
          success?: boolean;
        } | null;
        if (!cancelled && refreshRes.ok && refreshPayload?.success) {
          await syncAccessTokenFromBff();
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, authHydrated, token, sessionChecked]);

  useEffect(() => {
    if (!hydrated || !authHydrated) return;
    if (!token && !sessionChecked) return;
    if (!token) {
      router.replace('/login');
    }
  }, [hydrated, authHydrated, token, sessionChecked, router]);

  const {
    data: orgProfile,
    isLoading: orgLoading,
    refetch: refetchOrg,
  } = useQuery({
    queryKey: ['organization', 'profile'],
    queryFn: () =>
      loyaltyGet<{
        patronCrmEnabled?: boolean;
        hasLoyaltyProduct?: boolean;
        hasQueueProduct?: boolean;
        name?: string;
      }>('/organization/profile', token!),
    enabled: !!token,
  });

  const { data: orgLogo } = useQuery({
    queryKey: ['organization', 'logo'],
    queryFn: () => loyaltyGet<{ logoUrl: string | null }>('/organization/logo', token!),
    enabled: !!token,
    staleTime: 60_000,
  });

  const bootReady = hydrated && (authHydrated || Boolean(token));

  if (!bootReady) {
    return <LoyaltyBootShell />;
  }

  if (!token) {
    return <LoyaltyBootShell message="Authenticating…" />;
  }

  if (!orgLoading && orgProfile?.hasLoyaltyProduct === false) {
    return <LoyaltyActivationGate onActivated={() => void refetchOrg()} />;
  }

  const organization = {
    name: orgProfile?.name,
    logoUrl: orgLogo?.logoUrl ?? null,
  };

  return (
    <LoyaltyDashboardShell
      organization={organization}
      user={user}
      onLogout={() => logout()}
      hasQueueProduct={orgProfile?.hasQueueProduct === true}
    >
      {children}
    </LoyaltyDashboardShell>
  );
}
