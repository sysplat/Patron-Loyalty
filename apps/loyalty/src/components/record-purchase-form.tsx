'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function parsePurchaseDollarsToCents(raw: string): number | null {
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

type EarnPreview = {
  pointsAwarded: number;
  purchaseAmountCents: number;
};

export function RecordPurchaseForm({
  customerId,
  compact = false,
  prominent = false,
  onSuccess,
}: {
  customerId: string;
  compact?: boolean;
  /** Counter till layout: large amount field + live points preview */
  prominent?: boolean;
  onSuccess?: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [debouncedCents, setDebouncedCents] = useState<number | null>(null);

  useEffect(() => {
    const cents = parsePurchaseDollarsToCents(amount);
    const timer = window.setTimeout(() => setDebouncedCents(cents), 280);
    return () => window.clearTimeout(timer);
  }, [amount]);

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['loyalty', 'earn-preview', customerId, debouncedCents],
    queryFn: () =>
      loyaltyGet<EarnPreview>(
        `/loyalty/accounts/${customerId}/points/earn-preview?purchaseAmountCents=${debouncedCents}`,
        token!,
      ),
    enabled: !!token && !!customerId && debouncedCents != null && debouncedCents > 0,
  });

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
      setDebouncedCents(null);
      qc.invalidateQueries({ queryKey: ['loyalty', 'account', customerId] });
      qc.invalidateQueries({ queryKey: ['loyalty', 'lookup'] });
      qc.invalidateQueries({ queryKey: ['loyalty', 'earn-preview', customerId] });
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

  const previewPts = preview?.pointsAwarded;
  const showPreview = debouncedCents != null && debouncedCents > 0;

  return (
    <div
      className={cn(
        compact && !prominent ? 'space-y-2' : 'space-y-3',
        !compact && !prominent && 'bg-card rounded-xl border p-5',
        prominent && 'space-y-4',
      )}
    >
      {!compact && !prominent && (
        <div>
          <h3 className="text-sm font-semibold">Record purchase</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Enter the sale amount. Points are calculated from Program → PURCHASE earn rules.
          </p>
        </div>
      )}

      {prominent ? (
        <div className="space-y-3">
          <label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Sale amount
          </label>
          <div className="relative">
            <span className="text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold">
              $
            </span>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-16 pl-10 text-3xl font-semibold tracking-tight"
              aria-label="Purchase amount in dollars"
              autoComplete="off"
            />
          </div>
          <div
            className="bg-muted/50 flex min-h-[3rem] items-center justify-between rounded-lg px-4 py-3"
            aria-live="polite"
          >
            <span className="text-muted-foreground text-sm">Points to award</span>
            <span className="text-foreground text-2xl font-semibold tabular-nums">
              {showPreview
                ? previewLoading && previewPts == null
                  ? '…'
                  : `${previewPts ?? 0}`
                : '—'}
            </span>
          </div>
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="lg"
            className="h-12 w-full text-base"
            disabled={!amount.trim() || earnMutation.isPending || !token}
            onClick={() => earnMutation.mutate()}
          >
            {earnMutation.isPending
              ? 'Recording…'
              : showPreview && previewPts != null
                ? `Award ${previewPts} pts`
                : 'Award points'}
          </Button>
        </div>
      ) : (
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
          {showPreview && (
            <p className="text-muted-foreground w-full text-xs" aria-live="polite">
              Preview: {previewLoading && previewPts == null ? '…' : `${previewPts ?? 0} pts`} for
              this amount
            </p>
          )}
        </div>
      )}
    </div>
  );
}
