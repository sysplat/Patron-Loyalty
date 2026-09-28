'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost, loyaltyDelete, fetchPaginated } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, ChevronUp, Plus, Trash2, UserRound } from 'lucide-react';

type ViewTab = 'wallets' | 'gift-cards';
type AdjustKind = 'CREDIT' | 'DEBIT';
type GiftFilter = 'all' | 'active' | 'inactive' | 'empty';

interface CustomerListItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface GiftCard {
  id: string;
  code: string;
  balanceCents: number;
  initialBalanceCents: number;
  active?: boolean;
  status?: string;
  recipientEmail?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
}

interface WalletView {
  balanceCents: number;
  currency?: string;
  transactions: Array<{
    id: string;
    type: string;
    amountCents: number;
    description?: string | null;
    createdAt: string;
  }>;
}

const TABS: { id: ViewTab; label: string }[] = [
  { id: 'wallets', label: 'Patron wallets' },
  { id: 'gift-cards', label: 'Gift cards' },
];

const GIFT_FILTERS: { id: GiftFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive / expired' },
  { id: 'empty', label: 'Empty' },
];

function selectClassName(className?: string) {
  return cn(
    'border-input bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  );
}

function money(cents: number, currency = 'USD'): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

function dollarsToCents(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function giftCardStatus(card: GiftCard): {
  id: 'active' | 'inactive' | 'expired' | 'empty';
  label: string;
} {
  const now = Date.now();
  if (card.balanceCents <= 0) return { id: 'empty', label: 'Empty' };
  if (card.active === false || card.status === 'inactive' || card.status === 'redeemed') {
    return { id: 'inactive', label: 'Inactive' };
  }
  if (card.expiresAt && new Date(card.expiresAt).getTime() < now) {
    return { id: 'expired', label: 'Expired' };
  }
  return { id: 'active', label: 'Active' };
}

function PatronPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: CustomerListItem | null;
  onSelect: (c: CustomerListItem) => void;
  onClear: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search.trim());

  const { data: results, isFetched } = useQuery({
    queryKey: ['customers', 'wallet-picker', deferred],
    queryFn: () =>
      fetchPaginated<CustomerListItem>(
        `/customers?search=${encodeURIComponent(deferred)}&limit=8`,
        token!,
      ),
    enabled: !!token && deferred.length >= 2 && !selected,
  });

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{selected.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {[selected.email, selected.phone].filter(Boolean).join(' · ') || 'Selected patron'}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, or phone"
        autoComplete="off"
      />
      {deferred.length >= 2 && (results?.data.length ?? 0) > 0 ? (
        <ul className="border-border max-h-44 overflow-auto rounded-md border text-sm shadow-sm">
          {results!.data.map((c) => (
            <li key={c.id} className="border-border/60 border-b last:border-0">
              <button
                type="button"
                className="hover:bg-muted/60 w-full px-3 py-2.5 text-left"
                onClick={() => {
                  onSelect(c);
                  setSearch('');
                }}
              >
                <span className="block font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">
                  {[c.email, c.phone].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {deferred.length >= 2 && isFetched && (results?.data.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-xs">
          No match.{' '}
          <Link
            href="/patrons"
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            Open Customers
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export default function WalletPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const [tab, setTab] = useState<ViewTab>('wallets');
  const [guideOpen, setGuideOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [giftFilter, setGiftFilter] = useState<GiftFilter>('all');
  const [deleting, setDeleting] = useState<GiftCard | null>(null);

  const [patron, setPatron] = useState<CustomerListItem | null>(null);
  const [adjustKind, setAdjustKind] = useState<AdjustKind>('CREDIT');
  const [adjustDollars, setAdjustDollars] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const [giftDollars, setGiftDollars] = useState('25.00');
  const [giftEmail, setGiftEmail] = useState('');
  const [giftExpires, setGiftExpires] = useState('');

  const customerId = patron?.id ?? '';

  const { data: giftCards = [], isLoading: giftsLoading } = useQuery({
    queryKey: ['loyalty', 'gift-cards'],
    queryFn: () => loyaltyGet<GiftCard[]>('/loyalty/gift-cards', token!),
    enabled: !!token,
  });

  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletError,
    error: walletErr,
  } = useQuery({
    queryKey: ['loyalty', 'wallet', customerId],
    queryFn: () => loyaltyGet<WalletView>(`/loyalty/wallets/${customerId}`, token!),
    enabled: !!token && !!customerId,
  });

  const filteredGiftCards = useMemo(() => {
    return giftCards.filter((card) => {
      const status = giftCardStatus(card);
      if (giftFilter === 'all') return true;
      if (giftFilter === 'active') return status.id === 'active';
      if (giftFilter === 'empty') return status.id === 'empty';
      return status.id === 'inactive' || status.id === 'expired';
    });
  }, [giftCards, giftFilter]);

  const giftStats = useMemo(() => {
    const active = giftCards.filter((c) => giftCardStatus(c).id === 'active').length;
    const outstanding = giftCards.reduce((sum, c) => sum + Math.max(0, c.balanceCents), 0);
    return [
      { label: 'Gift cards', value: giftCards.length },
      { label: 'Active cards', value: active },
      { label: 'Outstanding balance', value: money(outstanding) },
      {
        label: 'Selected wallet',
        value: wallet ? money(wallet.balanceCents, wallet.currency ?? 'USD') : '—',
      },
    ];
  }, [giftCards, wallet]);

  const createGiftCard = useMutation({
    mutationFn: () => {
      const cents = dollarsToCents(giftDollars);
      if (cents === null || cents < 100) {
        throw new Error('Minimum gift card is $1.00');
      }
      return loyaltyPost<GiftCard>('/loyalty/gift-cards', token!, {
        initialBalanceCents: cents,
        recipientEmail: giftEmail.trim() || null,
        expiresAt: giftExpires ? new Date(`${giftExpires}T23:59:59`).toISOString() : null,
      });
    },
    onSuccess: (card) => {
      const code = card?.code;
      if (code && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(code).then(
          () => toast.success(`Gift card ${code} issued — code copied`),
          () => toast.success(`Gift card issued: ${code}`),
        );
      } else {
        toast.success(code ? `Gift card issued: ${code}` : 'Gift card issued');
      }
      setGiftDollars('25.00');
      setGiftEmail('');
      setGiftExpires('');
      setIssueOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'gift-cards'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not issue gift card'),
  });

  const removeGiftCard = useMutation({
    mutationFn: (id: string) => loyaltyDelete(`/loyalty/gift-cards/${id}`, token!),
    onSuccess: () => {
      toast.success('Gift card removed');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['loyalty', 'gift-cards'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not remove gift card'),
  });

  const adjustWallet = useMutation({
    mutationFn: () => {
      if (!customerId) throw new Error('Select a patron first');
      const cents = dollarsToCents(adjustDollars);
      if (cents === null) throw new Error('Enter a positive dollar amount');
      if (adjustKind === 'DEBIT' && wallet && cents > wallet.balanceCents) {
        throw new Error(
          `Insufficient balance (${money(wallet.balanceCents, wallet.currency ?? 'USD')} available)`,
        );
      }
      return loyaltyPost(`/loyalty/wallets/${customerId}/adjust`, token!, {
        type: adjustKind,
        amountCents: cents,
        description: adjustNote.trim() || 'Staff adjustment',
      });
    },
    onSuccess: () => {
      toast.success(adjustKind === 'CREDIT' ? 'Funds added' : 'Funds removed');
      setAdjustDollars('');
      setAdjustNote('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'wallet', customerId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not update wallet'),
  });

  function selectPatron(c: CustomerListItem) {
    setPatron(c);
    setAdjustDollars('');
    setAdjustNote('');
    setAdjustKind('CREDIT');
  }

  function clearPatron() {
    setPatron(null);
    setAdjustDollars('');
    setAdjustNote('');
    setAdjustKind('CREDIT');
  }
  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Stored value</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Cash balances on patron accounts and standalone gift cards — not loyalty points.
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
            size="sm"
            onClick={() => {
              setTab('gift-cards');
              setIssueOpen((v) => !v);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {issueOpen && tab === 'gift-cards' ? 'Close' : 'Issue gift card'}
          </Button>
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Staff guide</CardTitle>
            <CardDescription>
              Three different “balances” exist in Patron Loyalty. Use the right one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-3">
              <li className="space-y-1">
                <p className="text-foreground font-medium">Patron wallet (this page)</p>
                <p className="text-xs leading-relaxed">
                  Stored cash on a loyalty account. Staff can credit/debit for store credit,
                  refunds, or prepaid balance. Shown in the patron portal.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">Gift cards (this page)</p>
                <p className="text-xs leading-relaxed">
                  Standalone codes with a dollar balance. Not tied to a patron until redeemed at POS
                  / Integration API.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">Loyalty points</p>
                <p className="text-xs leading-relaxed">
                  Earn/redeem points for rewards — not cash. Adjust on the{' '}
                  <Link
                    href="/patrons"
                    className="text-foreground font-medium underline-offset-2 hover:underline"
                  >
                    customer profile
                  </Link>{' '}
                  or Counter.
                </p>
              </li>
            </ol>
            <p className="border-border/70 text-muted-foreground border-t pt-3 text-xs leading-relaxed">
              Promo codes (% / $ off) live under{' '}
              <Link
                href="/coupons"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                Promo codes
              </Link>
              . This page is money on account, not discounts.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {giftStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                if (item.id !== 'gift-cards') setIssueOpen(false);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === item.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {tab === 'wallets'
            ? 'Find a patron, then add or remove store credit'
            : 'Issue and review gift card codes'}
        </p>
      </div>

      {tab === 'wallets' ? (
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Find patron</CardTitle>
              <CardDescription>
                Search by name, email, or phone — no UUID paste. Opening a wallet creates one if
                needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-lg space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                Patron
              </Label>
              <PatronPicker selected={patron} onSelect={selectPatron} onClear={clearPatron} />
            </CardContent>
          </Card>

          {!patron ? (
            <Card>
              <CardContent className="px-6 py-12 text-center">
                <p className="text-sm font-medium">Select a patron to view their wallet</p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
                  Stored-value wallets are per loyalty account. Gift cards are listed on the other
                  tab.
                </p>
              </CardContent>
            </Card>
          ) : walletLoading ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : walletError ? (
            <Card>
              <CardContent className="px-6 py-10 text-center">
                <p className="text-sm font-medium">Could not load wallet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {(walletErr as Error)?.message || 'Try another patron or refresh.'}
                </p>
              </CardContent>
            </Card>
          ) : wallet ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Balance</CardTitle>
                    <CardDescription>{patron.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold tabular-nums tracking-tight">
                      {money(wallet.balanceCents, wallet.currency ?? 'USD')}
                    </p>
                    <Button variant="outline" size="sm" className="mt-4" asChild>
                      <Link href={`/patrons/${patron.id}`}>Open profile</Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Adjust balance</CardTitle>
                    <CardDescription>
                      Credit adds store credit. Debit removes it (cannot go below zero).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="grid gap-4 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        adjustWallet.mutate();
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="adjust-kind">Action</Label>
                        <select
                          id="adjust-kind"
                          value={adjustKind}
                          onChange={(e) => setAdjustKind(e.target.value as AdjustKind)}
                          className={selectClassName()}
                        >
                          <option value="CREDIT">Add funds (credit)</option>
                          <option value="DEBIT">Remove funds (debit)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="adjust-amount">Amount (USD)</Label>
                        <Input
                          id="adjust-amount"
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={adjustDollars}
                          onChange={(e) => setAdjustDollars(e.target.value)}
                          placeholder="10.00"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="adjust-note">
                          Note <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Input
                          id="adjust-note"
                          value={adjustNote}
                          onChange={(e) => setAdjustNote(e.target.value)}
                          placeholder="e.g. Comp for delayed order"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" disabled={adjustWallet.isPending || !adjustDollars}>
                          {adjustWallet.isPending
                            ? 'Saving…'
                            : adjustKind === 'CREDIT'
                              ? 'Add funds'
                              : 'Remove funds'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recent activity</CardTitle>
                  <CardDescription>Last 30 wallet transactions for this patron.</CardDescription>
                </CardHeader>
                {wallet.transactions.length === 0 ? (
                  <CardContent>
                    <p className="text-muted-foreground text-sm">No transactions yet.</p>
                  </CardContent>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                          <th className="px-4 py-2.5 font-medium">When</th>
                          <th className="px-4 py-2.5 font-medium">Type</th>
                          <th className="px-4 py-2.5 font-medium">Amount</th>
                          <th className="px-4 py-2.5 font-medium">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wallet.transactions.map((tx) => (
                          <tr
                            key={tx.id}
                            className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                          >
                            <td className="text-muted-foreground whitespace-nowrap px-4 py-3 text-xs">
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className="font-normal capitalize">
                                {tx.type.toLowerCase()}
                              </Badge>
                            </td>
                            <td
                              className={cn(
                                'px-4 py-3 font-medium tabular-nums',
                                tx.amountCents < 0 && 'text-amber-800 dark:text-amber-300',
                              )}
                            >
                              {tx.amountCents > 0 ? '+' : ''}
                              {money(tx.amountCents, wallet.currency ?? 'USD')}
                            </td>
                            <td className="text-muted-foreground max-w-[280px] px-4 py-3 text-xs">
                              {tx.description?.trim() || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'gift-cards' ? (
        <div className="space-y-5">
          {issueOpen ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Issue gift card</CardTitle>
                <CardDescription>
                  Creates a unique code with an initial dollar balance (minimum $1.00).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cents = dollarsToCents(giftDollars);
                    if (cents === null || cents < 100) {
                      toast.error('Minimum gift card is $1.00');
                      return;
                    }
                    if (giftEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(giftEmail.trim())) {
                      toast.error('Enter a valid email or leave blank');
                      return;
                    }
                    if (giftExpires) {
                      const end = new Date(`${giftExpires}T23:59:59`);
                      if (Number.isNaN(end.getTime()) || end.getTime() < Date.now()) {
                        toast.error('Expiry must be today or a future date');
                        return;
                      }
                    }
                    createGiftCard.mutate();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="gift-amount">Initial balance (USD)</Label>
                    <Input
                      id="gift-amount"
                      type="number"
                      min={1}
                      step="0.01"
                      value={giftDollars}
                      onChange={(e) => setGiftDollars(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gift-email">
                      Recipient email{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="gift-email"
                      type="email"
                      value={giftEmail}
                      onChange={(e) => setGiftEmail(e.target.value)}
                      placeholder="guest@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gift-expires">
                      Expires <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="gift-expires"
                      type="date"
                      value={giftExpires}
                      onChange={(e) => setGiftExpires(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
                    <Button type="submit" disabled={createGiftCard.isPending}>
                      {createGiftCard.isPending ? 'Issuing…' : 'Issue card'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setIssueOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {giftsLoading ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : giftCards.length === 0 ? (
            <Card>
              <CardContent className="px-6 py-12 text-center">
                <p className="text-sm font-medium">No gift cards yet</p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
                  Issue a card to generate a redeemable code with a starting balance.
                </p>
                <Button type="button" size="sm" className="mt-5" onClick={() => setIssueOpen(true)}>
                  Issue gift card
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {GIFT_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGiftFilter(item.id)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      giftFilter === item.id
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {filteredGiftCards.length === 0 ? (
                <Card>
                  <CardContent className="px-6 py-10 text-center">
                    <p className="text-sm font-medium">No cards in this filter</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Try another filter or issue a new gift card.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                          <th className="px-4 py-2.5 font-medium">Code</th>
                          <th className="px-4 py-2.5 font-medium">Balance</th>
                          <th className="px-4 py-2.5 font-medium">Initial</th>
                          <th className="px-4 py-2.5 font-medium">Status</th>
                          <th className="px-4 py-2.5 font-medium">Recipient</th>
                          <th className="px-4 py-2.5 font-medium">Expires</th>
                          <th className="px-4 py-2.5 text-right font-medium">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGiftCards.map((card) => {
                          const status = giftCardStatus(card);
                          return (
                            <tr
                              key={card.id}
                              className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                            >
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  className="font-mono text-sm font-semibold tracking-wide underline-offset-2 hover:underline"
                                  title="Copy code"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(card.code).then(
                                      () => toast.success('Code copied'),
                                      () => toast.message(card.code),
                                    );
                                  }}
                                >
                                  {card.code}
                                </button>
                              </td>
                              <td className="px-4 py-3 font-medium tabular-nums">
                                {money(card.balanceCents)}
                              </td>
                              <td className="text-muted-foreground px-4 py-3 text-xs tabular-nums">
                                {money(card.initialBalanceCents)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={status.id === 'active' ? 'default' : 'secondary'}
                                  className="font-normal"
                                >
                                  {status.label}
                                </Badge>
                              </td>
                              <td className="text-muted-foreground px-4 py-3 text-xs">
                                {card.recipientEmail?.trim() || '—'}
                              </td>
                              <td className="text-muted-foreground whitespace-nowrap px-4 py-3 text-xs">
                                {card.expiresAt
                                  ? new Date(card.expiresAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleting(card)}
                                  disabled={removeGiftCard.isPending}
                                  aria-label={`Remove ${card.code}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      ) : null}

      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Remove {deleting.code}?</CardTitle>
              <CardDescription>
                This permanently deletes the gift card. Remaining balance of{' '}
                {money(deleting.balanceCents)} will no longer be redeemable.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => removeGiftCard.mutate(deleting.id)}
                disabled={removeGiftCard.isPending}
                autoFocus
              >
                {removeGiftCard.isPending ? 'Removing…' : 'Remove card'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleting(null)}
                disabled={removeGiftCard.isPending}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
