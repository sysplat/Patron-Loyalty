'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch, loyaltyPost, loyaltyDelete } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  description?: string | null;
  pointsCost: number;
  type: string;
  active: boolean;
  stock: number | null;
}

export default function RewardsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [pointsCost, setPointsCost] = useState('100');

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['loyalty', 'rewards'],
    queryFn: () => loyaltyGet<Reward[]>('/loyalty/rewards?all=true', token!),
    enabled: !!token,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      loyaltyPatch(`/loyalty/rewards/${id}`, token!, { active }),
    onSuccess: () => {
      toast.success('Reward updated');
      qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: () => toast.error('Failed to update reward'),
  });

  const create = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/rewards', token!, {
        name,
        pointsCost: Number(pointsCost),
        type: 'DISCOUNT',
        active: true,
      }),
    onSuccess: () => {
      toast.success('Reward created');
      setName('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: () => toast.error('Failed to create reward'),
  });

  const deleteReward = useMutation({
    mutationFn: (id: string) => loyaltyDelete(`/loyalty/rewards/${id}`, token!),
    onSuccess: () => {
      toast.success('Reward deleted');
      qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: () => toast.error('Failed to delete reward'),
  });

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Rewards catalog</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add reward</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Reward name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Input
            placeholder="Points cost"
            value={pointsCost}
            onChange={(e) => setPointsCost(e.target.value)}
            className="max-w-[120px]"
          />
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            Create
          </Button>
        </CardContent>
      </Card>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rewards.map((r) => (
            <Card key={r.id} className={!r.active ? 'opacity-60' : undefined}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-base">{r.name}</CardTitle>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive.mutate({ id: r.id, active: !r.active })}
                    disabled={toggleActive.isPending}
                  >
                    {r.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (!confirm(`Delete reward "${r.name}"? This cannot be undone.`)) return;
                      deleteReward.mutate(r.id);
                    }}
                    disabled={deleteReward.isPending}
                    title="Delete reward"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                <p>{r.description ?? r.type}</p>
                <p className="text-foreground mt-2 font-medium">{r.pointsCost} points</p>
                {r.stock !== null && <p>Stock: {r.stock}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
