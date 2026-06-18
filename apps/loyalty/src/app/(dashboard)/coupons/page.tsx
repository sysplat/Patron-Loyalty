'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

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

  const { data: coupons = [] } = useQuery({
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

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Coupons & promotions</h1>
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
              <p className="text-sm">
                {c.usedCount}
                {c.maxUses ? ` / ${c.maxUses}` : ''} uses
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
