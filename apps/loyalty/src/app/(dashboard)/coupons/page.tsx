'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost, loyaltyDelete } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

type CouponType = 'PERCENT' | 'FIXED' | 'BOGO';
type ListFilter = 'all' | 'active' | 'inactive' | 'exhausted';

interface Coupon {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  usedCount: number;
  maxUses: number | null;
  minPurchaseCents?: number | null;
  active: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
}

const TYPE_META: Record<
  CouponType,
  { label: string; hint: string; valueLabel: string; placeholder: string }
> = {
  PERCENT: {
    label: 'Percent off',
    hint: 'Checkout discount as a percentage of the sale.',
    valueLabel: 'Percent',
    placeholder: '10',
  },
  FIXED: {
    label: 'Fixed amount off',
    hint: 'Dollar amount subtracted from the sale (stored as cents).',
    valueLabel: 'Amount (USD)',
    placeholder: '5.00',
  },
  BOGO: {
    label: 'Buy one, get one',
    hint: 'BOGO promo for POS / integration to interpret. Value is usually 1.',
    valueLabel: 'Free item qty',
    placeholder: '1',
  },
};

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive / expired' },
  { id: 'exhausted', label: 'Used up' },
];

function selectClassName(className?: string) {
  return cn(
    'border-input bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  );
}

function formatDiscount(coupon: Coupon): string {
  if (coupon.type === 'PERCENT') return `${coupon.value}% off`;
  if (coupon.type === 'FIXED') return `$${(coupon.value / 100).toFixed(2)} off`;
  if (coupon.type === 'BOGO') return `BOGO ×${coupon.value}`;
  return `${coupon.type} ${coupon.value}`;
}

function couponStatus(coupon: Coupon): {
  id: 'active' | 'inactive' | 'expired' | 'exhausted' | 'scheduled';
  label: string;
} {
  const now = Date.now();
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { id: 'exhausted', label: 'Used up' };
  }
  if (!coupon.active) return { id: 'inactive', label: 'Inactive' };
  if (coupon.validUntil && new Date(coupon.validUntil).getTime() < now) {
    return { id: 'expired', label: 'Expired' };
  }
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) {
    return { id: 'scheduled', label: 'Scheduled' };
  }
  return { id: 'active', label: 'Active' };
}

function ListSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </CardContent>
    </Card>
  );
}

export default function CouponsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const [guideOpen, setGuideOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<CouponType>('PERCENT');
  const [value, setValue] = useState('10');
  const [maxUses, setMaxUses] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['loyalty', 'coupons'],
    queryFn: () => loyaltyGet<Coupon[]>('/loyalty/coupons', token!),
    enabled: !!token,
  });

  const typeInfo = TYPE_META[type];

  const enriched = useMemo(
    () =>
      coupons.map((c) => ({
        ...c,
        status: couponStatus(c),
      })),
    [coupons],
  );

  const filtered = useMemo(() => {
    return enriched.filter((c) => {
      switch (listFilter) {
        case 'active':
          return c.status.id === 'active' || c.status.id === 'scheduled';
        case 'inactive':
          return c.status.id === 'inactive' || c.status.id === 'expired';
        case 'exhausted':
          return c.status.id === 'exhausted';
        case 'all':
          return true;
        default: {
          const _exhaustive: never = listFilter;
          return _exhaustive;
        }
      }
    });
  }, [enriched, listFilter]);

  const stats = useMemo(() => {
    const active = enriched.filter((c) => c.status.id === 'active').length;
    const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);
    const exhausted = enriched.filter((c) => c.status.id === 'exhausted').length;
    return [
      { label: 'Codes', value: coupons.length },
      { label: 'Active now', value: active },
      { label: 'Total redemptions', value: totalUses },
      { label: 'Used up', value: exhausted },
    ];
  }, [coupons, enriched]);

  const create = useMutation({
    mutationFn: () => {
      const parsedValue =
        type === 'FIXED' ? Math.round(Number(value) * 100) : Math.round(Number(value));
      return loyaltyPost('/loyalty/coupons', token!, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type,
        value: parsedValue,
        maxUses: maxUses ? Number(maxUses) : null,
        minPurchaseCents: minPurchase ? Math.round(Number(minPurchase) * 100) : null,
        validUntil: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : null,
        active: true,
      });
    },
    onSuccess: () => {
      toast.success('Promo code saved');
      setCode('');
      setName('');
      setType('PERCENT');
      setValue('10');
      setMaxUses('');
      setMinPurchase('');
      setValidUntil('');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'coupons'] });
    },
    onError: () => toast.error('Could not save promo code'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => loyaltyDelete(`/loyalty/coupons/${id}`, token!),
    onSuccess: () => {
      toast.success('Promo code deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['loyalty', 'coupons'] });
    },
    onError: () => toast.error('Could not delete promo code'),
  });

  const validate = useMutation({
    mutationFn: () =>
      loyaltyPost<{ valid: boolean; coupon?: Coupon }>('/loyalty/coupons/validate', token!, {
        code: checkCode.trim().toUpperCase(),
      }),
    onSuccess: (data) => {
      if (data.valid && data.coupon) {
        setCheckResult(
          `Valid · ${data.coupon.code} · ${formatDiscount(data.coupon)} · ${couponStatus(data.coupon).label}`,
        );
        toast.success('Code is valid');
      } else {
        setCheckResult('Not valid');
      }
    },
    onError: (err: Error) => {
      setCheckResult(err.message || 'Not valid');
      toast.error(err.message || 'Code is not valid');
    },
  });

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Promo codes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Checkout discounts patrons redeem by code — separate from points rewards and message
            campaigns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setGuideOpen((v) => !v)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Guide
            {guideOpen ? (
              <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            )}
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            {createOpen ? 'Close' : 'New code'}
          </Button>
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Staff guide</CardTitle>
            <CardDescription>
              Promo codes are checkout discounts. They do not spend loyalty points.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-3">
              <li className="space-y-1">
                <p className="text-foreground font-medium">Promo codes (this page)</p>
                <p className="text-xs leading-relaxed">
                  Share a code like <span className="font-mono">SAVE10</span>. Validated at Counter
                  POS / Integration API when the patron checks out.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">Rewards catalog</p>
                <p className="text-xs leading-relaxed">
                  Patrons spend points for free items or perks. Configure under{' '}
                  <Link
                    href="/rewards"
                    className="text-foreground font-medium underline-offset-2 hover:underline"
                  >
                    Rewards
                  </Link>
                  .
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">Campaigns</p>
                <p className="text-xs leading-relaxed">
                  SMS/email that announce a code. Create the code here first, then mention it in{' '}
                  <Link
                    href="/campaigns"
                    className="text-foreground font-medium underline-offset-2 hover:underline"
                  >
                    Campaigns
                  </Link>
                  .
                </p>
              </li>
            </ol>
            <p className="border-border/70 text-muted-foreground border-t pt-3 text-xs leading-relaxed">
              Percent = % off the sale. Fixed = dollar amount off. BOGO = buy-one-get-one for
              connected POS. Use <span className="text-foreground font-medium">Check a code</span>{' '}
              below to verify before printing or texting it.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Check a code</CardTitle>
          <CardDescription>
            Validate whether a code is active and still within its usage limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full max-w-xs space-y-1.5">
            <Label htmlFor="check-code">Code</Label>
            <Input
              id="check-code"
              value={checkCode}
              onChange={(e) => {
                setCheckCode(e.target.value.toUpperCase());
                setCheckResult(null);
              }}
              placeholder="SAVE10"
              className="font-mono uppercase"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => validate.mutate()}
            disabled={checkCode.trim().length < 2 || validate.isPending}
          >
            {validate.isPending ? 'Checking…' : 'Validate'}
          </Button>
          {checkResult ? (
            <p className="text-muted-foreground text-sm sm:pb-2">{checkResult}</p>
          ) : null}
        </CardContent>
      </Card>

      {createOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New promo code</CardTitle>
            <CardDescription>
              Letters, numbers, hyphens, and underscores only. Codes are stored uppercase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmedCode = code.trim().toUpperCase();
                if (!/^[A-Z0-9_-]+$/i.test(trimmedCode) || trimmedCode.length < 2) {
                  toast.error('Use letters, numbers, - or _ (min 2 characters)');
                  return;
                }
                if (!name.trim()) {
                  toast.error('Add a display name');
                  return;
                }
                const n = Number(value);
                if (!Number.isFinite(n) || n <= 0) {
                  toast.error('Enter a positive value');
                  return;
                }
                if (type === 'PERCENT' && (n < 1 || n > 100)) {
                  toast.error('Percent must be between 1 and 100');
                  return;
                }
                if (type === 'FIXED' && Math.round(n * 100) < 1) {
                  toast.error('Fixed amount must be at least $0.01');
                  return;
                }
                create.mutate();
              }}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="coupon-code">Code</Label>
                      <Input
                        id="coupon-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="SAVE10"
                        className="font-mono uppercase"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="coupon-name">Display name</Label>
                      <Input
                        id="coupon-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="10% off first visit"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="coupon-type">Discount type</Label>
                    <select
                      id="coupon-type"
                      value={type}
                      onChange={(e) => {
                        const next = e.target.value as CouponType;
                        setType(next);
                        setValue(next === 'PERCENT' ? '10' : next === 'FIXED' ? '5.00' : '1');
                      }}
                      className={selectClassName()}
                    >
                      {(Object.keys(TYPE_META) as CouponType[]).map((key) => (
                        <option key={key} value={key}>
                          {TYPE_META[key].label}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground text-xs leading-relaxed">{typeInfo.hint}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="coupon-value">{typeInfo.valueLabel}</Label>
                      <Input
                        id="coupon-value"
                        type="number"
                        min={type === 'FIXED' ? 0.01 : 1}
                        max={type === 'PERCENT' ? 100 : undefined}
                        step={type === 'FIXED' ? '0.01' : '1'}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={typeInfo.placeholder}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="coupon-max">
                        Max redemptions{' '}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Input
                        id="coupon-max"
                        type="number"
                        min={1}
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="coupon-min">
                      Minimum purchase (USD){' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="coupon-min"
                      type="number"
                      min={0}
                      step="0.01"
                      value={minPurchase}
                      onChange={(e) => setMinPurchase(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="coupon-until">
                      Valid until{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="coupon-until"
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      Ends at end of day in the staff browser timezone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Saving…' : 'Save code'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setListFilter(item.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                listFilter === item.id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {filtered.length} of {coupons.length}
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-12 text-center">
            <p className="text-sm font-medium">
              {coupons.length === 0 ? 'No promo codes yet' : 'No codes in this filter'}
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
              {coupons.length === 0
                ? 'Create a code to offer percent-off, dollar-off, or BOGO at checkout.'
                : 'Try another filter or create a new code.'}
            </p>
            {coupons.length === 0 ? (
              <Button type="button" size="sm" className="mt-5" onClick={() => setCreateOpen(true)}>
                New code
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Offer</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Uses</th>
                  <th className="px-4 py-2.5 font-medium">Limits</th>
                  <th className="px-4 py-2.5 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-mono text-sm font-semibold tracking-wide">{c.code}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{c.name}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-medium">{formatDiscount(c)}</td>
                    <td className="px-4 py-3 align-top">
                      <Badge
                        variant={c.status.id === 'active' ? 'default' : 'secondary'}
                        className="font-normal"
                      >
                        {c.status.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top text-xs tabular-nums">
                      {c.usedCount}
                      {c.maxUses !== null ? ` / ${c.maxUses}` : ''}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 align-top text-xs">
                      {[
                        c.minPurchaseCents ? `Min $${(c.minPurchaseCents / 100).toFixed(2)}` : null,
                        c.validUntil
                          ? `Until ${new Date(c.validUntil).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleting(c)}
                        disabled={remove.isPending}
                        aria-label={`Delete ${c.code}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Delete {deleting.code}?</CardTitle>
              <CardDescription>
                This removes the code permanently. Past redemptions stay in history.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => remove.mutate(deleting.id)}
                disabled={remove.isPending}
                autoFocus
              >
                {remove.isPending ? 'Deleting…' : 'Delete code'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleting(null)}
                disabled={remove.isPending}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
