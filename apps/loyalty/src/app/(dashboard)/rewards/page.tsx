'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch, loyaltyPost, loyaltyDelete } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { ConfirmDialog, EmptyState, PageHeader, PageShell } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trash2, Gift, Coins, Tag, Plus, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Reward {
  id: string;
  name: string;
  description?: string | null;
  pointsCost: number;
  type: string;
  active: boolean;
  stock: number | null;
}

interface PendingRedemption {
  id: string;
  pointsSpent: number;
  redeemedAt: string;
  reward: { id: string; name: string };
  account: {
    customer: { name: string | null; phone: string | null } | null;
  };
}

const REWARD_TYPE_LABEL: Record<string, string> = {
  DISCOUNT: 'Cash discount',
  PERCENTAGE: 'Percentage off',
  FREE_ITEM: 'Free item / service',
};

function rewardTypeLabel(type: string): string {
  return REWARD_TYPE_LABEL[type] ?? type.toLowerCase().replaceAll('_', ' ');
}

export default function RewardsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const [showBuilder, setShowBuilder] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pointsCost, setPointsCost] = useState('');
  const [rewardType, setRewardType] = useState('DISCOUNT');
  const [deleting, setDeleting] = useState<Reward | null>(null);
  const [cancelingRedemption, setCancelingRedemption] = useState<PendingRedemption | null>(null);

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['loyalty', 'rewards'],
    queryFn: () => loyaltyGet<Reward[]>('/loyalty/rewards?all=true', token!),
    enabled: !!token,
  });

  const { data: pendingRedemptions = [] } = useQuery({
    queryKey: ['loyalty', 'redemptions', 'pending'],
    queryFn: () => loyaltyGet<PendingRedemption[]>('/loyalty/redemptions?status=pending', token!),
    enabled: !!token,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      loyaltyPatch(`/loyalty/rewards/${id}`, token!, { active }),
    onSuccess: () => {
      toast.success('Reward status updated');
      qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: () => toast.error('Failed to update reward'),
  });

  const create = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/rewards', token!, {
        name,
        description,
        pointsCost: Number(pointsCost),
        type: rewardType,
        active: true,
      }),
    onSuccess: () => {
      toast.success('Reward added to catalog');
      setName('');
      setDescription('');
      setPointsCost('');
      setRewardType('DISCOUNT');
      setShowBuilder(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: () => toast.error('Failed to create reward'),
  });

  const deleteReward = useMutation({
    mutationFn: (id: string) => loyaltyDelete(`/loyalty/rewards/${id}`, token!),
    onSuccess: () => {
      toast.success('Reward deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: () => toast.error('Failed to delete reward'),
  });

  const fulfillRedemption = useMutation({
    mutationFn: (id: string) => loyaltyPost(`/loyalty/redemptions/${id}/fulfill`, token!, {}),
    onSuccess: () => {
      toast.success('Redemption fulfilled');
      qc.invalidateQueries({ queryKey: ['loyalty', 'redemptions'] });
    },
    onError: () => toast.error('Failed to fulfill redemption'),
  });

  const cancelRedemption = useMutation({
    mutationFn: (id: string) => loyaltyPost(`/loyalty/redemptions/${id}/cancel`, token!, {}),
    onSuccess: () => {
      toast.success('Redemption cancelled — points restored');
      setCancelingRedemption(null);
      qc.invalidateQueries({ queryKey: ['loyalty', 'redemptions'] });
      qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: () => toast.error('Failed to cancel redemption'),
  });

  return (
    <PageShell>
      <PageHeader
        title="Rewards Catalog"
        subtitle="Define what your customers can redeem their points for."
        actions={
          !showBuilder ? (
            <Button size="sm" onClick={() => setShowBuilder(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Reward
            </Button>
          ) : undefined
        }
      />

      {pendingRedemptions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending redemptions</CardTitle>
            <CardDescription>
              Mark rewards as fulfilled when handed to the patron, or cancel to restore points.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRedemptions.map((r) => {
              const c = r.account.customer;
              const patron = c?.name || c?.phone || 'Patron';
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{r.reward.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {patron} · {r.pointsSpent} pts · {new Date(r.redeemedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => fulfillRedemption.mutate(r.id)}
                      disabled={fulfillRedemption.isPending || cancelRedemption.isPending}
                    >
                      Fulfill
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCancelingRedemption(r)}
                      disabled={fulfillRedemption.isPending || cancelRedemption.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {showBuilder && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>Create New Reward</CardTitle>
            <CardDescription>Fill out the details for your new catalog offering.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reward Title</label>
                <Input
                  placeholder="e.g. $10 Off Your Next Visit"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Points Cost</label>
                <div className="relative">
                  <Coins className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                  <Input
                    type="number"
                    placeholder="e.g. 500"
                    value={pointsCost}
                    onChange={(e) => setPointsCost(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                placeholder="A brief description of what this reward entails."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Reward Type</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'DISCOUNT', label: 'Cash Discount', icon: Tag },
                  { value: 'PERCENTAGE', label: 'Percentage Off', icon: Tag },
                  { value: 'FREE_ITEM', label: 'Free Item/Service', icon: Gift },
                ].map((t) => (
                  <div
                    key={t.value}
                    onClick={() => setRewardType(t.value)}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${rewardType === t.value ? 'border-primary bg-primary/5 text-primary ring-primary ring-1' : 'hover:bg-muted/50'}`}
                  >
                    <t.icon className="h-6 w-6" />
                    <span className="text-sm font-semibold">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-6">
              <Button variant="ghost" onClick={() => setShowBuilder(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => create.mutate()}
                disabled={!name || !pointsCost || create.isPending}
              >
                Publish Reward
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rewards.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent>
            <EmptyState
              icon={Gift}
              title="Your catalog is empty"
              description="Create rewards to incentivize your customers to keep coming back and spending their points."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <Card
              key={r.id}
              className={`relative overflow-hidden transition-all hover:shadow-md ${!r.active ? 'opacity-60 grayscale' : 'border-primary/10'}`}
            >
              {!r.active && (
                <div className="absolute right-3 top-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 dark:bg-slate-800">
                  INACTIVE
                </div>
              )}
              {r.active && (
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" /> ACTIVE
                </div>
              )}

              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                  {r.type === 'FREE_ITEM' ? (
                    <Gift className="h-6 w-6" />
                  ) : (
                    <Tag className="h-6 w-6" />
                  )}
                </div>

                <h3 className="mb-1 pr-16 text-lg font-bold leading-tight">{r.name}</h3>
                <p className="text-muted-foreground mb-4 min-h-[40px] text-sm leading-relaxed">
                  {r.description ||
                    `Redeem ${r.pointsCost} points for a ${rewardTypeLabel(r.type).toLowerCase()}.`}
                </p>

                <div className="mb-6 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Coins className="h-4 w-4" />
                    <span>{r.pointsCost} pts</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  <Button
                    size="sm"
                    variant={r.active ? 'outline' : 'secondary'}
                    onClick={() => toggleActive.mutate({ id: r.id, active: !r.active })}
                    disabled={toggleActive.isPending || deleteReward.isPending}
                    className="min-w-[100px]"
                  >
                    {r.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive ml-auto gap-1.5"
                    onClick={() => setDeleting(r)}
                    disabled={deleteReward.isPending}
                    aria-label={`Delete ${r.name}`}
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {deleting ? (
        <ConfirmDialog
          title="Delete this reward?"
          description="This permanently removes the reward from your catalog. Patrons will no longer be able to redeem it. Past redemptions stay in history."
          confirmLabel="Delete reward"
          pendingLabel="Deleting…"
          pending={deleteReward.isPending}
          destructive
          summary={
            <div className="bg-muted/50 flex gap-3 rounded-lg border px-3.5 py-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  deleting.type === 'FREE_ITEM'
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {deleting.type === 'FREE_ITEM' ? (
                  <Gift className="h-5 w-5" aria-hidden />
                ) : (
                  <Tag className="h-5 w-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight">{deleting.name}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {deleting.pointsCost.toLocaleString()} pts · {rewardTypeLabel(deleting.type)}
                  {deleting.active ? ' · Active' : ' · Inactive'}
                </p>
              </div>
            </div>
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteReward.mutate(deleting.id)}
        />
      ) : null}

      {cancelingRedemption ? (
        <ConfirmDialog
          title="Cancel this redemption?"
          description="Points spent on this redemption will be restored to the patron."
          confirmLabel="Cancel redemption"
          pendingLabel="Cancelling…"
          pending={cancelRedemption.isPending}
          destructive
          summary={
            <div className="bg-muted/50 rounded-lg border px-3.5 py-3 text-sm">
              <p className="font-medium">{cancelingRedemption.reward.name}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {(cancelingRedemption.account.customer?.name ||
                  cancelingRedemption.account.customer?.phone ||
                  'Patron') + ` · ${cancelingRedemption.pointsSpent} pts`}
              </p>
            </div>
          }
          onCancel={() => setCancelingRedemption(null)}
          onConfirm={() => cancelRedemption.mutate(cancelingRedemption.id)}
        />
      ) : null}
    </PageShell>
  );
}
