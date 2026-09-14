'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

function parsePurchaseDollarsToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

type EarnPurchaseResult = {
  pointsAwarded: number;
  purchaseAmountCents: number;
  account: { pointsBalance: number };
};

export function RecordPurchaseForm({
  customerId,
  compact = false,
  onSuccess,
}: {
  customerId: string;
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const earnMutation = useMutation({
    mutationFn: async () => {
      const purchaseAmountCents = parsePurchaseDollarsToCents(amount);
      if (purchaseAmountCents == null) {
        throw new Error('Enter a valid purchase amount greater than zero.');
      }
      return loyaltyPost<EarnPurchaseResult>(
        `/loyalty/accounts/${customerId}/points/earn`,
        token!,
        {
          purchaseAmountCents,
          description: note.trim() || undefined,
        },
      );
    },
    onSuccess: (result) => {
      const pts = result?.pointsAwarded ?? 0;
      const balance = result?.account?.pointsBalance;
      toast.success(
        balance != null
          ? `Awarded ${pts} pts · new balance ${balance}`
          : `Awarded ${pts} pts for this purchase`,
      );
      setAmount('');
      setNote('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'account', customerId] });
      qc.invalidateQueries({ queryKey: ['loyalty', 'lookup'] });
      onSuccess?.();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not record purchase. Check Program earn rules.';
      toast.error(message);
    },
  });

  return (
    <div className={compact ? 'space-y-2' : 'bg-card space-y-3 rounded-xl border p-5'}>
      {!compact && (
        <div>
          <h3 className="text-sm font-semibold">Record purchase</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Enter the sale amount. Points are calculated from Program → PURCHASE earn rules (e.g. 1
            pt per $1).
          </p>
        </div>
      )}
      {compact && (
        <p className="text-muted-foreground text-xs">
          Sale amount → points from your PURCHASE earn rules
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Input
          inputMode="decimal"
          placeholder="Amount ($)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="max-w-[140px]"
          aria-label="Purchase amount in dollars"
        />
        <Input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="max-w-xs flex-1"
        />
        <Button
          size="sm"
          disabled={!amount.trim() || earnMutation.isPending || !token}
          onClick={() => earnMutation.mutate()}
        >
          {earnMutation.isPending ? 'Recording…' : 'Award points'}
        </Button>
      </div>
    </div>
  );
}
