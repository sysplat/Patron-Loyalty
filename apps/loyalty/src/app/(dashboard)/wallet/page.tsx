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

interface GiftCard {
  id: string;
  code: string;
  balanceCents: number;
  initialBalanceCents: number;
  status: string;
  expiresAt?: string | null;
}

interface WalletView {
  balanceCents: number;
  transactions: Array<{
    id: string;
    type: string;
    amountCents: number;
    description?: string | null;
    createdAt: string;
  }>;
}

export default function WalletPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [giftAmount, setGiftAmount] = useState('2500');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');

  const { data: giftCards = [], isLoading: giftsLoading } = useQuery({
    queryKey: ['loyalty', 'gift-cards'],
    queryFn: () => loyaltyGet<GiftCard[]>('/loyalty/gift-cards', token!),
    enabled: !!token,
  });

  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ['loyalty', 'wallet', customerId],
    queryFn: () => loyaltyGet<WalletView>(`/loyalty/wallets/${customerId}`, token!),
    enabled: !!token && !!customerId,
  });

  const createGiftCard = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/gift-cards', token!, {
        initialBalanceCents: Number(giftAmount),
      }),
    onSuccess: () => {
      toast.success('Gift card created');
      qc.invalidateQueries({ queryKey: ['loyalty', 'gift-cards'] });
    },
    onError: () => toast.error('Could not create gift card'),
  });

  const adjustWallet = useMutation({
    mutationFn: () =>
      loyaltyPost(`/loyalty/wallets/${customerId}/adjust`, token!, {
        type: adjustType,
        amountCents: Number(adjustAmount),
        description: 'Staff adjustment',
      }),
    onSuccess: () => {
      toast.success('Wallet updated');
      setAdjustAmount('');
      refetchWallet();
    },
    onError: () => toast.error('Could not adjust wallet'),
  });

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Wallet & gift cards</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patron wallet lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Patron ID"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {wallet && (
            <>
              <p className="text-sm">
                Balance:{' '}
                <span className="font-semibold">${(wallet.balanceCents / 100).toFixed(2)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as 'CREDIT' | 'DEBIT')}
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                >
                  <option value="CREDIT">Credit</option>
                  <option value="DEBIT">Debit</option>
                </select>
                <Input
                  placeholder="Cents"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="max-w-[120px]"
                />
                <Button
                  onClick={() => adjustWallet.mutate()}
                  disabled={!adjustAmount || !customerId || adjustWallet.isPending}
                >
                  Adjust
                </Button>
              </div>
              {wallet.transactions.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {wallet.transactions.map((tx) => (
                    <li key={tx.id} className="text-muted-foreground">
                      {tx.type} ${(tx.amountCents / 100).toFixed(2)} ·{' '}
                      {new Date(tx.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue gift card</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Initial balance (cents)"
            value={giftAmount}
            onChange={(e) => setGiftAmount(e.target.value)}
            className="max-w-[180px]"
          />
          <Button onClick={() => createGiftCard.mutate()} disabled={createGiftCard.isPending}>
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gift cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {giftsLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : giftCards.length === 0 ? (
            <p className="text-muted-foreground text-sm">No gift cards yet.</p>
          ) : (
            giftCards.map((card) => (
              <div key={card.id} className="flex justify-between text-sm">
                <span className="font-mono">{card.code}</span>
                <span>
                  ${(card.balanceCents / 100).toFixed(2)} · {card.status}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
