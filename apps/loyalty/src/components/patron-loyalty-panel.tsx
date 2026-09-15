'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Copy, ExternalLink, Gift } from 'lucide-react';
import { RecordPurchaseForm } from '@/components/record-purchase-form';

interface LoyaltyAccount {
  id: string;
  pointsBalance: number;
  lifetimePointsEarned: number;
  lifetimePointsBurned: number;
  referralCode: string;
  tier?: { name: string; color?: string | null } | null;
  ledger: Array<{
    id: string;
    type: string;
    points: number;
    balanceAfter: number;
    description?: string | null;
    createdAt: string;
  }>;
}

interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  active: boolean;
}

export function PatronLoyaltyPanel({ customerId }: { customerId: string }) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const {
    data: account,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['loyalty', 'account', customerId],
    queryFn: () => loyaltyGet<LoyaltyAccount>(`/loyalty/accounts/${customerId}`, token!),
    enabled: !!token && !!customerId,
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['loyalty', 'rewards'],
    queryFn: () => loyaltyGet<Reward[]>('/loyalty/rewards', token!),
    enabled: !!token,
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      loyaltyPost(`/loyalty/accounts/${customerId}/points/adjust`, token!, {
        points: Number(adjustPoints),
        description: adjustNote || undefined,
      }),
    onSuccess: () => {
      toast.success('Points updated');
      setAdjustPoints('');
      setAdjustNote('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'account', customerId] });
    },
    onError: () => toast.error('Could not adjust points'),
  });

  const redeemMutation = useMutation({
    mutationFn: (rewardId: string) =>
      loyaltyPost('/loyalty/rewards/redeem', token!, { customerId, rewardId }),
    onSuccess: () => {
      toast.success('Reward redeemed');
      qc.invalidateQueries({ queryKey: ['loyalty', 'account', customerId] });
    },
    onError: () => toast.error('Redemption failed'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !account) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Loyalty</CardTitle>
          <CardDescription>No loyalty account for this customer yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Award points from Counter or Record purchase once they are enrolled.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cardUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/portal/${account.referralCode}`
      : `/portal/${account.referralCode}`;

  const activeRewards = rewards.filter((r) => r.active).slice(0, 6);

  const copyCardLink = () => {
    void navigator.clipboard.writeText(cardUrl);
    toast.success('Digital card link copied');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Loyalty</CardTitle>
            <CardDescription>Balance, purchases, rewards, and ledger</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {account.tier?.name ? (
              <Badge variant="secondary" className="font-normal">
                {account.tier.name}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground font-normal">
                No tier
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={copyCardLink}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Card link
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8" asChild>
              <a href={cardUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open card
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-muted/40 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Balance
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {account.pointsBalance}
              <span className="text-muted-foreground ml-1 text-sm font-normal">pts</span>
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Lifetime earned
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {account.lifetimePointsEarned}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Lifetime redeemed
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {account.lifetimePointsBurned}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Referral
            </p>
            <p className="mt-1 truncate font-mono text-sm font-medium">{account.referralCode}</p>
          </div>
        </div>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Record purchase</h3>
            <p className="text-muted-foreground text-xs">
              Enter the sale amount so program earn rules apply (same as Counter).
            </p>
          </div>
          <RecordPurchaseForm customerId={customerId} compact />
        </section>

        <section className="border-border/70 space-y-3 border-t pt-5">
          <div>
            <h3 className="text-sm font-semibold">Adjust points</h3>
            <p className="text-muted-foreground text-xs">
              Manual correction only. Prefer Record purchase for sales.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-points" className="text-muted-foreground text-xs">
                Points (±)
              </Label>
              <Input
                id="adjust-points"
                placeholder="e.g. 50 or -10"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                className="w-full sm:w-[140px]"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="adjust-note" className="text-muted-foreground text-xs">
                Note
              </Label>
              <Input
                id="adjust-note"
                placeholder="Optional reason"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="h-10 shrink-0"
              disabled={!adjustPoints || adjustMutation.isPending}
              onClick={() => adjustMutation.mutate()}
            >
              Apply
            </Button>
          </div>
        </section>

        {activeRewards.length > 0 ? (
          <section className="border-border/70 space-y-3 border-t pt-5">
            <div className="flex items-center gap-2">
              <Gift className="text-muted-foreground h-4 w-4" />
              <h3 className="text-sm font-semibold">Redeem reward</h3>
            </div>
            <ul className="divide-border/70 divide-y rounded-lg border">
              {activeRewards.map((r) => {
                const canAfford = account.pointsBalance >= r.pointsCost;
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {r.pointsCost} pts
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={redeemMutation.isPending || !canAfford}
                      onClick={() => redeemMutation.mutate(r.id)}
                    >
                      Redeem
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="border-border/70 space-y-3 border-t pt-5">
          <h3 className="text-sm font-semibold">Recent ledger</h3>
          {account.ledger.length === 0 ? (
            <p className="text-muted-foreground text-sm">No transactions yet.</p>
          ) : (
            <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
              {account.ledger.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="tabular-nums">
                        {row.points > 0 ? `+${row.points}` : row.points}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs font-normal uppercase tracking-wide">
                        {row.type}
                      </span>
                    </p>
                    {row.description ? (
                      <p className="text-muted-foreground truncate text-xs">{row.description}</p>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {new Date(row.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
