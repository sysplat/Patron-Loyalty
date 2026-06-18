'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loyaltyGet } from '@/lib/api-response';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { QlessqLogoMark } from '@/components/brand';

type ActivationStatus = {
  organizationName?: string;
  hasQueueProduct?: boolean;
  canActivateTrial?: boolean;
  trialUsed?: boolean;
  checkoutAvailable?: boolean;
  loyaltyPlan?: { name: string; priceMonthly: number } | null;
};

export function LoyaltyActivationGate({ onActivated }: { onActivated: () => void }) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['loyalty', 'activation'],
    queryFn: () => loyaltyGet<ActivationStatus>('/loyalty/activation/status', token!),
    enabled: !!token,
  });

  const trialMutation = useMutation({
    mutationFn: () => api.post('/loyalty/activation/trial', {}, { token: token! }),
    onSuccess: async () => {
      toast.success('Patron Loyalty trial started');
      await qc.invalidateQueries({ queryKey: ['organization', 'profile'] });
      await qc.invalidateQueries({ queryKey: ['loyalty', 'activation'] });
      onActivated();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not start trial';
      toast.error(message);
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () => {
      const origin = window.location.origin.replace(/\/$/, '');
      return api.post<{ url?: string }>(
        '/loyalty/activation/checkout',
        {
          successUrl: `${origin}/?loyalty=activated`,
          cancelUrl: `${origin}/`,
          billingInterval: 'monthly',
        },
        { token: token! },
      );
    },
    onSuccess: (res) => {
      const url = (res as { url?: string })?.url;
      if (url) window.location.href = url;
      else toast.error('Checkout could not be started');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not start checkout';
      toast.error(message);
    },
  });

  if (isLoading) {
    return (
      <div className="bg-muted/30 flex min-h-screen items-center justify-center p-8">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  const orgName = status?.organizationName ?? 'your organization';
  const hasQueue = status?.hasQueueProduct === true;

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-6 dark:bg-gradient-to-br dark:from-slate-950 dark:via-[#0c1528] dark:to-[#070b14]">
      <div className="bg-card/80 w-full max-w-lg rounded-xl border p-8 shadow-lg backdrop-blur-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <QlessqLogoMark size={48} />
          <h1 className="text-xl font-semibold">Activate Patron Loyalty</h1>
          <p className="text-muted-foreground text-sm">
            {hasQueue
              ? `Add loyalty CRM, points, and campaigns to ${orgName} — no platform admin required.`
              : `Enable Patron Loyalty for ${orgName}.`}
          </p>
        </div>

        <div className="space-y-3">
          {status?.canActivateTrial ? (
            <button
              type="button"
              disabled={trialMutation.isPending}
              onClick={() => trialMutation.mutate()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {trialMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gift className="h-4 w-4" />
              )}
              Start 14-day free trial
            </button>
          ) : null}

          {status?.checkoutAvailable ? (
            <button
              type="button"
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
              className="border-input hover:bg-muted/70 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Subscribe
              {status.loyaltyPlan ? ` — $${status.loyaltyPlan.priceMonthly}/mo` : ''}
            </button>
          ) : null}
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
          Need loyalty only, without queue management?{' '}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create a Patron Loyalty account
          </Link>
          . Enterprise deals can still be enabled by your platform operator.
        </p>
      </div>
    </div>
  );
}
