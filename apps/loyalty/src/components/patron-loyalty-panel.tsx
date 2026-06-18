'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

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
    return <p className="text-muted-foreground text-sm">Loading loyalty account…</p>;
  }
  if (isError || !account) {
    return <p className="text-muted-foreground text-sm">No loyalty account yet.</p>;
  }

  const cardUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/portal/${account.referralCode}`
      : `/portal/${account.referralCode}`;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-5">
        <h2 className="mb-3 font-semibold">Loyalty</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            Balance: <span className="font-semibold">{account.pointsBalance}</span> pts
          </p>
          <p>
            Tier: <span className="font-semibold">{account.tier?.name ?? 'None'}</span>
          </p>
          <p>Lifetime earned: {account.lifetimePointsEarned}</p>
          <p>Lifetime redeemed: {account.lifetimePointsBurned}</p>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Digital card:{' '}
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {account.referralCode}
          </a>
        </p>
      </div>

      <div className="bg-card rounded-xl border p-5">
        <h3 className="mb-2 text-sm font-semibold">Adjust points</h3>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="± points"
            value={adjustPoints}
            onChange={(e) => setAdjustPoints(e.target.value)}
            className="max-w-[120px]"
          />
          <Input
            placeholder="Note (optional)"
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            className="max-w-xs flex-1"
          />
          <Button
            size="sm"
            disabled={!adjustPoints || adjustMutation.isPending}
            onClick={() => adjustMutation.mutate()}
          >
            Apply
          </Button>
        </div>
      </div>

      {rewards.length > 0 && (
        <div className="bg-card rounded-xl border p-5">
          <h3 className="mb-2 text-sm font-semibold">Redeem reward</h3>
          <div className="space-y-2">
            {rewards.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {r.name} · {r.pointsCost} pts
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={redeemMutation.isPending || account.pointsBalance < r.pointsCost}
                  onClick={() => redeemMutation.mutate(r.id)}
                >
                  Redeem
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border p-5">
        <h3 className="mb-2 text-sm font-semibold">Recent ledger</h3>
        {account.ledger.length === 0 ? (
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
            {account.ledger.map((row) => (
              <li key={row.id} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                <span>
                  {row.type} {row.points > 0 ? `+${row.points}` : row.points}
                  {row.description ? ` · ${row.description}` : ''}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
