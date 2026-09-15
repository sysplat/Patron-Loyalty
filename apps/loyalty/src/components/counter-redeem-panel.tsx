'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  active: boolean;
}

export function CounterRedeemPanel({
  customerId,
  pointsBalance,
  onRedeemed,
}: {
  customerId: string;
  pointsBalance: number;
  onRedeemed?: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['loyalty', 'rewards'],
    queryFn: () => loyaltyGet<Reward[]>('/loyalty/rewards', token!),
    enabled: !!token,
    staleTime: 30_000,
  });

  const redeemMutation = useMutation({
    mutationFn: (rewardId: string) =>
      loyaltyPost('/loyalty/rewards/redeem', token!, { customerId, rewardId }),
    onSuccess: () => {
      toast.success('Reward redeemed');
      qc.invalidateQueries({ queryKey: ['loyalty', 'lookup'] });
      qc.invalidateQueries({ queryKey: ['loyalty', 'account', customerId] });
      onRedeemed?.();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Redemption failed');
    },
  });

  const activeRewards = rewards.filter((r) => r.active !== false).slice(0, 6);

  if (isLoading) {
    return <p className="text-muted-foreground text-xs">Loading rewards…</p>;
  }

  if (activeRewards.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No active rewards yet. Add one under Rewards to redeem here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {activeRewards.map((reward) => {
        const canAfford = pointsBalance >= reward.pointsCost;
        return (
          <li
            key={reward.id}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{reward.name}</p>
              <p className="text-muted-foreground text-xs">{reward.pointsCost} pts</p>
            </div>
            <Button
              size="sm"
              variant={canAfford ? 'default' : 'outline'}
              disabled={!canAfford || redeemMutation.isPending}
              onClick={() => redeemMutation.mutate(reward.id)}
            >
              Redeem
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
