'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIONS, RESOURCES } from '@queueplatform/shared';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { api } from '@/lib/api';
import { fetchPaginated, unwrapApiData } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { hasPermission } from '@/lib/rbac-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  Users,
} from 'lucide-react';

/** Set true to surface SMS allowance, packs, and checkout in staff Billing / pricing. */
const SHOW_SMS_CREDITS = false;

interface PlanRow {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  description?: string | null;
  features?: Record<string, unknown> | null;
  limits?: Record<string, unknown> | null;
}

interface SubscriptionView {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  plan?: PlanRow | null;
  usage?: {
    branches?: { current: number; limit: number };
    users?: { current: number; limit: number };
    smsCredits?: {
      current: number;
      planBase: number;
      purchasedBonus: number;
      limit: number;
    };
  };
}

interface InvoiceRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueAt: string;
  paidAt?: string | null;
}

interface SmsPack {
  slug: string;
  label: string;
  description: string;
  messages: number;
  priceUsd: number;
  unitPriceUsd: number;
  checkoutEnabled: boolean;
}

const GUIDE: { title: string; body: string }[] = [
  {
    title: 'Plan',
    body: SHOW_SMS_CREDITS
      ? 'Your subscription covers seats, SMS allowance, and loyalty features. Change plans here or in Stripe.'
      : 'Your subscription covers staff seats and loyalty features. Change plans here or in Stripe.',
  },
  {
    title: 'Payment method',
    body: 'Cards and billing email live in the Stripe customer portal — we never store full card numbers.',
  },
  {
    title: 'Invoices',
    body: 'Paid invoices sync here after Stripe settles. Download PDFs from the portal if you need a receipt.',
  },
  ...(SHOW_SMS_CREDITS
    ? [
        {
          title: 'SMS credits',
          body: 'Campaign and notification SMS draw from your monthly plan base plus any packs you buy.',
        },
      ]
    : [
        {
          title: 'Seats',
          body: 'Active teammates count toward your plan seat limit. Manage them under Setup → Team.',
        },
      ]),
];

function formatMoney(amount: number, currency = 'USD'): string {
  return amount.toLocaleString(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'paid') {
    return 'border-transparent bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
  }
  if (s === 'trialing') {
    return 'border-transparent bg-sky-500/10 text-sky-800 dark:text-sky-300';
  }
  if (s === 'past_due' || s === 'open' || s === 'unpaid') {
    return 'border-transparent bg-amber-500/10 text-amber-900 dark:text-amber-300';
  }
  if (s === 'canceled' || s === 'cancelled' || s === 'void') {
    return 'border-transparent bg-muted text-muted-foreground';
  }
  return 'border-transparent bg-muted text-muted-foreground';
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'trialing') return 'Trial';
  if (s === 'canceling' || s === 'cancel_at_period_end') return 'Canceling';
  if (s === 'canceled' || s === 'cancelled') return 'Canceled';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLoyaltyPlan(plan: PlanRow): boolean {
  if (plan.slug.toLowerCase().includes('loyalty')) return true;
  const features = plan.features ?? {};
  return features.patronLoyalty === true;
}

function UsageMeter({
  label,
  current,
  limit,
  hint,
}: {
  label: string;
  current: number;
  limit: number;
  hint?: string;
}) {
  const pct =
    limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : current > 0 ? 100 : 0;
  const nearLimit = limit > 0 && current / limit >= 0.85;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {current.toLocaleString()}
          {limit > 0 ? ` / ${limit.toLocaleString()}` : ''}
        </p>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            nearLimit ? 'bg-amber-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5 pb-10">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}

function BillingPageInner() {
  const token = useAuthStore((s) => s.accessToken);
  const currentUserRole = useAuthStore((s) => String(s.user?.role ?? '').toLowerCase());
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledSmsParam = useRef<string | null>(null);

  const canRead = hasPermission(currentUserRole, RESOURCES.BILLING, ACTIONS.READ);
  const canUpdate = hasPermission(currentUserRole, RESOURCES.BILLING, ACTIONS.UPDATE);

  const [guideOpen, setGuideOpen] = useState(false);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  useEffect(() => {
    if (!SHOW_SMS_CREDITS) return;
    const sms = searchParams.get('sms');
    if (!sms || handledSmsParam.current === sms) return;
    handledSmsParam.current = sms;
    if (sms === 'success') {
      toast.success('SMS pack purchase started — credits appear after Stripe confirms payment');
      void qc.invalidateQueries({ queryKey: ['billing'] });
    } else if (sms === 'cancel') {
      toast.message('SMS pack checkout canceled');
    }
    router.replace('/billing', { scroll: false });
  }, [searchParams, qc, router]);

  const {
    data: subscription,
    isLoading: subLoading,
    isError: subError,
    error: subErr,
    refetch: refetchSub,
  } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () =>
      api
        .get<unknown>('/billing/subscription', { token: token!, showErrorToast: false })
        .then((payload) => unwrapApiData<SubscriptionView>(payload)),
    enabled: !!token && canRead,
    retry: false,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () =>
      api
        .get<unknown>('/billing/plans', { token: token!, showErrorToast: false })
        .then((payload) => unwrapApiData<PlanRow[]>(payload) ?? []),
    enabled: !!token && canRead,
  });

  const { data: invoicesPage, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => fetchPaginated<InvoiceRow>('/billing/invoices?limit=20', token!),
    enabled: !!token && canRead,
  });

  const { data: smsPacksPayload, isLoading: packsLoading } = useQuery({
    queryKey: ['billing', 'sms-packs'],
    queryFn: async () => {
      const payload = await api.get<unknown>('/billing/sms-packs', {
        token: token!,
        showErrorToast: false,
      });
      const packs = unwrapApiData<SmsPack[]>(payload) ?? [];
      const meta =
        payload && typeof payload === 'object' && 'meta' in payload
          ? (payload as { meta?: { checkoutEnabled?: boolean } }).meta
          : undefined;
      return {
        packs,
        checkoutEnabled: meta?.checkoutEnabled ?? packs.some((p) => p.checkoutEnabled),
      };
    },
    enabled: !!token && canRead && SHOW_SMS_CREDITS,
  });

  /** Never fall back to QMS queue plans — only loyalty SKUs. */
  const loyaltyPlans = useMemo(() => plans.filter(isLoyaltyPlan), [plans]);

  const currentPlanId = subscription?.plan?.id;
  const otherPlans = useMemo(() => {
    if (!currentPlanId) return loyaltyPlans;
    return loyaltyPlans.filter((p) => p.id !== currentPlanId);
  }, [loyaltyPlans, currentPlanId]);

  const sms = subscription?.usage?.smsCredits;
  const seats = subscription?.usage?.users;
  const smsRemaining = sms && sms.limit > 0 ? Math.max(0, sms.limit - sms.current) : null;

  const portalMutation = useMutation({
    mutationFn: () => {
      const returnUrl = `${window.location.origin}/billing`;
      return api
        .post<unknown>('/billing/portal', { returnUrl }, { token: token! })
        .then((payload) => unwrapApiData<{ url: string }>(payload));
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
      else toast.error('Could not open billing portal');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not open billing portal'),
  });

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) =>
      api
        .post<unknown>('/billing/subscription/change', { planId }, { token: token! })
        .then((payload) => unwrapApiData(payload)),
    onSuccess: async () => {
      toast.success('Plan updated');
      await qc.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not change plan'),
  });

  const smsCheckoutMutation = useMutation({
    mutationFn: (packSlug: string) => {
      const origin = window.location.origin.replace(/\/$/, '');
      return api
        .post<unknown>(
          '/billing/sms-checkout',
          {
            packSlug,
            successUrl: `${origin}/billing?sms=success`,
            cancelUrl: `${origin}/billing?sms=cancel`,
          },
          { token: token! },
        )
        .then((payload) => unwrapApiData<{ url?: string }>(payload));
    },
    onMutate: (packSlug) => setBuyingPack(packSlug),
    onSettled: () => setBuyingPack(null),
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
      else toast.error('Could not start SMS checkout');
    },
    onError: (err: Error) => toast.error(err.message || 'Could not start SMS checkout'),
  });

  if (!canRead) {
    return (
      <div className="space-y-5 pb-10">
        <div>
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Billing</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Only the organization owner can manage plan, payment method
            {SHOW_SMS_CREDITS ? ', and SMS credits' : ', and invoices'}.
          </p>
        </div>
        <Card>
          <CardContent className="flex items-start gap-3 p-5 text-sm">
            <AlertTriangle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-muted-foreground">
              Ask your owner to open Setup → Billing, or invite you as owner if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoices = invoicesPage?.data ?? [];
  const packs = smsPacksPayload?.packs ?? [];
  const smsCheckoutEnabled = smsPacksPayload?.checkoutEnabled === true;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Billing</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your plan, payment method, invoices
            {SHOW_SMS_CREDITS ? ', and SMS credits' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setGuideOpen((v) => !v)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Guide
            {guideOpen ? (
              <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchSub();
              void qc.invalidateQueries({ queryKey: ['billing'] });
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {canUpdate ? (
            <Button
              type="button"
              size="sm"
              disabled={portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
            >
              {portalMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Payment method
            </Button>
          ) : null}
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Billing guide</CardTitle>
            <CardDescription>
              After trial or checkout, this is your ongoing account home — not just an activation
              gate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-2">
              {GUIDE.map((item) => (
                <li key={item.title} className="space-y-1">
                  <p className="text-foreground font-medium">{item.title}</p>
                  <p className="text-xs leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {subLoading ? (
        <div
          className={cn(
            'grid gap-3 sm:grid-cols-2',
            SHOW_SMS_CREDITS ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
          )}
        >
          {Array.from({ length: SHOW_SMS_CREDITS ? 4 : 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : subError ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-medium text-amber-950 dark:text-amber-100">
                No active subscription found
              </p>
              <p className="text-amber-900/80 dark:text-amber-100/80">
                {(subErr as Error)?.message ||
                  'Activate Patron Loyalty or complete checkout to manage billing here.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : subscription ? (
        <>
          <div
            className={cn(
              'grid gap-3 sm:grid-cols-2',
              SHOW_SMS_CREDITS ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
            )}
          >
            {[
              {
                label: 'Plan',
                value: subscription.plan?.name ?? '—',
              },
              {
                label: 'Status',
                value: statusLabel(
                  subscription.cancelAtPeriodEnd ? 'canceling' : subscription.status,
                ),
              },
              {
                label: 'Seats',
                value:
                  seats && seats.limit > 0
                    ? `${seats.current}/${seats.limit}`
                    : String(seats?.current ?? '—'),
              },
              ...(SHOW_SMS_CREDITS
                ? [
                    {
                      label: 'SMS left',
                      value: smsRemaining !== null ? smsRemaining.toLocaleString() : '—',
                    },
                  ]
                : []),
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p className="mt-1 truncate text-2xl font-semibold tabular-nums tracking-tight">
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Current plan</CardTitle>
                    <CardDescription>
                      Period ends {formatDate(subscription.currentPeriodEnd)}
                      {subscription.trialEndsAt
                        ? ` · Trial ends ${formatDate(subscription.trialEndsAt)}`
                        : ''}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'font-normal capitalize',
                      statusBadgeClass(
                        subscription.cancelAtPeriodEnd ? 'canceled' : subscription.status,
                      ),
                    )}
                  >
                    {statusLabel(
                      subscription.cancelAtPeriodEnd ? 'canceling' : subscription.status,
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-lg font-semibold">{subscription.plan?.name ?? 'Plan'}</p>
                  <p className="text-muted-foreground text-sm">
                    {subscription.plan
                      ? `${formatMoney(subscription.plan.priceMonthly)}/mo · ${formatMoney(subscription.plan.priceYearly)}/yr`
                      : 'Pricing unavailable'}
                  </p>
                </div>

                <UsageMeter
                  label="Staff seats"
                  current={seats?.current ?? 0}
                  limit={seats?.limit ?? 0}
                  hint={
                    seats && seats.limit > 0 && seats.current >= seats.limit
                      ? 'Seat limit reached — free a seat on Team or upgrade.'
                      : 'Active teammates count toward your plan limit.'
                  }
                />
                {SHOW_SMS_CREDITS ? (
                  <UsageMeter
                    label="SMS this cycle"
                    current={sms?.current ?? 0}
                    limit={sms?.limit ?? 0}
                    hint={
                      sms
                        ? `Plan base ${sms.planBase.toLocaleString()}${
                            sms.purchasedBonus > 0
                              ? ` + ${sms.purchasedBonus.toLocaleString()} purchased`
                              : ''
                          }`
                        : undefined
                    }
                  />
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  {canUpdate ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={portalMutation.isPending}
                      onClick={() => portalMutation.mutate()}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Manage in Stripe
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href="/team">
                      <Users className="mr-2 h-4 w-4" />
                      Team seats
                    </Link>
                  </Button>
                </div>
                {canUpdate ? (
                  <p className="text-muted-foreground text-xs">
                    Cancel or update your card in Stripe — we sync status when Stripe confirms.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Change plan</CardTitle>
                <CardDescription>
                  Switch loyalty plans instantly. Payment method updates happen in Stripe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {otherPlans.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    You are on the only available loyalty plan. Use Stripe to adjust billing
                    interval or payment details.
                  </p>
                ) : (
                  otherPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatMoney(plan.priceMonthly)}/mo
                          {typeof plan.limits?.maxUsers === 'number'
                            ? ` · ${plan.limits.maxUsers} seats`
                            : ''}
                          {SHOW_SMS_CREDITS && typeof plan.limits?.smsCreditsTotal === 'number'
                            ? ` · ${plan.limits.smsCreditsTotal} SMS`
                            : ''}
                        </p>
                      </div>
                      {canUpdate ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={changePlanMutation.isPending}
                          onClick={() => changePlanMutation.mutate(plan.id)}
                        >
                          {changePlanMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Switch
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {SHOW_SMS_CREDITS ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">SMS message packs</CardTitle>
                <CardDescription>
                  One-time top-ups added on top of your plan SMS allowance. Used by campaigns and
                  notifications.
                </CardDescription>
              </div>
              <MessageSquare className="text-muted-foreground h-5 w-5 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            {packsLoading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-lg" />
                ))}
              </div>
            ) : packs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No SMS packs are configured yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {packs.map((pack) => {
                  const buying = buyingPack === pack.slug;
                  return (
                    <div key={pack.slug} className="flex flex-col rounded-lg border p-4">
                      <p className="font-medium">{pack.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                        {formatMoney(pack.priceUsd)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {pack.messages.toLocaleString()} messages · ~
                        {formatMoney(pack.unitPriceUsd)}
                        /msg
                      </p>
                      <p className="text-muted-foreground mt-2 flex-1 text-xs leading-relaxed">
                        {pack.description}
                      </p>
                      {canUpdate ? (
                        <Button
                          type="button"
                          size="sm"
                          className="mt-4"
                          disabled={!smsCheckoutEnabled || smsCheckoutMutation.isPending}
                          onClick={() => smsCheckoutMutation.mutate(pack.slug)}
                        >
                          {buying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Buy pack
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {!smsCheckoutEnabled && packs.length > 0 ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Stripe is not configured on this environment — SMS checkout is unavailable.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoices</CardTitle>
          <CardDescription>
            Recent invoices synced from Stripe. Open the portal for PDFs and payment history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No invoices yet. They appear after your first paid period
              {SHOW_SMS_CREDITS ? ' or SMS pack purchase' : ''}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-xs uppercase tracking-wide">
                    <th className="pb-2 pr-3 font-medium">Issued</th>
                    <th className="pb-2 pr-3 font-medium">Amount</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 tabular-nums">{formatDate(inv.issuedAt)}</td>
                      <td className="py-2.5 pr-3 font-medium tabular-nums">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          variant="secondary"
                          className={cn('font-normal capitalize', statusBadgeClass(inv.status))}
                        >
                          {statusLabel(inv.status)}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground py-2.5 tabular-nums">
                        {formatDate(inv.paidAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
