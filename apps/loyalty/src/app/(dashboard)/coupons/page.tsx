'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost, loyaltyDelete } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trash2, Ticket } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const EmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
      <Icon className="text-muted-foreground/50 h-6 w-6" />
    </div>
    <p className="text-base font-medium">{title}</p>
    <p className="text-muted-foreground mt-1 max-w-[250px] text-sm">{description}</p>
  </div>
);

interface Coupon {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  usedCount: number;
  maxUses: number | null;
  active: boolean;
}

export default function CouponsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [value, setValue] = useState('10');

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['loyalty', 'coupons'],
    queryFn: () => loyaltyGet<Coupon[]>('/loyalty/coupons', token!),
    enabled: !!token,
  });

  const create = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/coupons', token!, {
        code: code.toUpperCase(),
        name,
        type: 'PERCENT',
        value: Number(value),
        active: true,
      }),
    onSuccess: () => {
      toast.success('Coupon created');
      setCode('');
      setName('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'coupons'] });
    },
  });

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => loyaltyDelete(`/loyalty/coupons/${id}`, token!),
    onSuccess: () => {
      toast.success('Coupon deleted');
      qc.invalidateQueries({ queryKey: ['loyalty', 'coupons'] });
    },
    onError: () => toast.error('Failed to delete coupon'),
  });

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Coupons &amp; promotions</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create coupon</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="max-w-[140px]"
          />
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Input
            placeholder="%"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="max-w-[80px]"
          />
          <Button onClick={() => create.mutate()} disabled={!code || !name || create.isPending}>
            Create
          </Button>
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="w-1/3 space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="pt-6">
            <EmptyState
              icon={Ticket}
              title="No coupons created"
              description="Create your first coupon or promotion above to share with your customers."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{c.code}</p>
                  <p className="text-muted-foreground text-sm">
                    {c.name} · {c.type} {c.value}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm">
                    {c.usedCount}
                    {c.maxUses ? ` / ${c.maxUses}` : ''} uses
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (!confirm(`Delete coupon "${c.code}"? This cannot be undone.`)) return;
                      deleteCoupon.mutate(c.id);
                    }}
                    disabled={deleteCoupon.isPending}
                    title="Delete coupon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
