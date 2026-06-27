'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Program {
  enabled: boolean;
  pointsCurrencyName: string;
  displayCurrencyCode?: string;
  defaultLocale?: string;
  defaultEarnPoints: number;
  referralBonusPoints: number;
  referredBonusPoints: number;
  pointsExpiryDays: number | null;
  tiers: Array<{
    id: string;
    name: string;
    slug: string;
    minLifetimePoints: number;
    color?: string | null;
  }>;
  earnRules: Array<{
    id: string;
    name: string;
    eventType: string;
    points: number;
    active: boolean;
    conditions?: Record<string, unknown> | null;
  }>;
}

export default function ProgramPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const [currencyName, setCurrencyName] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState('');
  const [defaultLocale, setDefaultLocale] = useState('');
  const [defaultEarn, setDefaultEarn] = useState('');
  const [expiryDays, setExpiryDays] = useState('');
  const [tierName, setTierName] = useState('');
  const [tierSlug, setTierSlug] = useState('');
  const [tierMinPoints, setTierMinPoints] = useState('0');
  const [ruleName, setRuleName] = useState('');
  const [ruleEvent, setRuleEvent] = useState('PURCHASE');
  const [rulePoints, setRulePoints] = useState('1');
  const [ruleMinPurchase, setRuleMinPurchase] = useState('');
  const [ruleBranchId, setRuleBranchId] = useState('');
  const [ruleMinLifetime, setRuleMinLifetime] = useState('');

  const {
    data: program,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['loyalty', 'program'],
    queryFn: () => loyaltyGet<Program>('/loyalty/program', token!),
    enabled: !!token,
  });

  const updateProgram = useMutation({
    mutationFn: (body: Record<string, unknown>) => loyaltyPatch('/loyalty/program', token!, body),
    onSuccess: () => {
      toast.success('Program updated');
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
    },
    onError: () => toast.error('Could not update program'),
  });

  const createTier = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/program/tiers', token!, {
        name: tierName,
        slug: tierSlug.toLowerCase().replace(/\s+/g, '-'),
        minLifetimePoints: Number(tierMinPoints),
      }),
    onSuccess: () => {
      toast.success('Tier created');
      setTierName('');
      setTierSlug('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
    },
    onError: () => toast.error('Could not create tier'),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      loyaltyPatch(`/loyalty/program/earn-rules/${id}`, token!, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
    },
    onError: () => toast.error('Could not update earn rule'),
  });

  const createRule = useMutation({
    mutationFn: () => {
      const conditions: Record<string, unknown> = {};
      if (ruleMinPurchase) conditions.minPurchaseCents = Number(ruleMinPurchase) * 100;
      if (ruleBranchId.trim()) conditions.branchId = ruleBranchId.trim();
      if (ruleMinLifetime) conditions.minLifetimePoints = Number(ruleMinLifetime);
      return loyaltyPost('/loyalty/program/earn-rules', token!, {
        name: ruleName,
        eventType: ruleEvent,
        points: Number(rulePoints),
        active: true,
        ...(Object.keys(conditions).length ? { conditions } : {}),
      });
    },
    onSuccess: () => {
      toast.success('Earn rule created');
      setRuleName('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
    },
    onError: () => toast.error('Could not create earn rule'),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading program…</p>;
  if (isError || !program) {
    return <p className="text-destructive text-sm">Could not load program.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Loyalty program</h1>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>Status: {program.enabled ? 'Active' : 'Paused'}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateProgram.mutate({ enabled: !program.enabled })}
            >
              {program.enabled ? 'Pause' : 'Activate'}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder={`Currency (${program.pointsCurrencyName})`}
              defaultValue={program.pointsCurrencyName}
              onChange={(e) => setCurrencyName(e.target.value)}
            />
            <Input
              placeholder={`ISO currency (${program.displayCurrencyCode ?? 'USD'})`}
              defaultValue={program.displayCurrencyCode ?? 'USD'}
              onChange={(e) => setDisplayCurrency(e.target.value.toUpperCase())}
            />
            <Input
              placeholder={`Locale (${program.defaultLocale ?? 'en'})`}
              defaultValue={program.defaultLocale ?? 'en'}
              onChange={(e) => setDefaultLocale(e.target.value)}
            />
            <Input
              placeholder={`Default earn (${program.defaultEarnPoints})`}
              defaultValue={String(program.defaultEarnPoints)}
              onChange={(e) => setDefaultEarn(e.target.value)}
            />
            <Input
              placeholder={`Expiry days (${program.pointsExpiryDays ?? 'none'})`}
              defaultValue={program.pointsExpiryDays ? String(program.pointsExpiryDays) : ''}
              onChange={(e) => setExpiryDays(e.target.value)}
            />
            <Button
              onClick={() =>
                updateProgram.mutate({
                  pointsCurrencyName: currencyName || program.pointsCurrencyName,
                  displayCurrencyCode: displayCurrency || program.displayCurrencyCode || 'USD',
                  defaultLocale: defaultLocale || program.defaultLocale || 'en',
                  defaultEarnPoints: defaultEarn ? Number(defaultEarn) : program.defaultEarnPoints,
                  pointsExpiryDays: expiryDays ? Number(expiryDays) : null,
                })
              }
              disabled={updateProgram.isPending}
            >
              Save settings
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Referrer bonus: {program.referralBonusPoints} pts · Referred:{' '}
            {program.referredBonusPoints} pts · Display currency:{' '}
            {program.displayCurrencyCode ?? 'USD'} · Locale: {program.defaultLocale ?? 'en'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membership tiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {program.tiers.map((t) => (
            <div key={t.id} className="flex justify-between text-sm">
              <span>{t.name}</span>
              <span>{t.minLifetimePoints}+ lifetime points</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Input
              placeholder="Tier name"
              value={tierName}
              onChange={(e) => setTierName(e.target.value)}
              className="max-w-[140px]"
            />
            <Input
              placeholder="slug"
              value={tierSlug}
              onChange={(e) => setTierSlug(e.target.value)}
              className="max-w-[120px]"
            />
            <Input
              placeholder="Min points"
              value={tierMinPoints}
              onChange={(e) => setTierMinPoints(e.target.value)}
              className="max-w-[100px]"
            />
            <Button
              onClick={() => createTier.mutate()}
              disabled={!tierName || !tierSlug || createTier.isPending}
            >
              Add tier
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Earn rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {program.earnRules.map((r) => {
            const cond = (r.conditions ?? {}) as Record<string, unknown>;
            const condParts: string[] = [];
            if (cond.minPurchaseCents)
              condParts.push(`min $${Number(cond.minPurchaseCents) / 100}`);
            if (cond.branchId) condParts.push(`branch ${String(cond.branchId).slice(0, 8)}…`);
            if (cond.minLifetimePoints) condParts.push(`≥${cond.minLifetimePoints} lifetime pts`);
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {r.name} — {r.points} pts · {r.eventType}
                  {condParts.length ? ` · if ${condParts.join(', ')}` : ''}
                  {!r.active ? ' (inactive)' : ''}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleRule.mutate({ id: r.id, active: !r.active })}
                  disabled={toggleRule.isPending}
                >
                  {r.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Input
              placeholder="Rule name"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="max-w-[160px]"
            />
            <select
              value={ruleEvent}
              onChange={(e) => setRuleEvent(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              <option value="PURCHASE">PURCHASE</option>
              <option value="MANUAL">MANUAL</option>
              <option value="TICKET_COMPLETED">TICKET_COMPLETED</option>
              <option value="APPOINTMENT_COMPLETED">APPOINTMENT_COMPLETED</option>
              <option value="REVIEW_SUBMITTED">REVIEW_SUBMITTED</option>
              <option value="REFERRAL_COMPLETED">REFERRAL_COMPLETED</option>
            </select>
            <Input
              placeholder="Points"
              value={rulePoints}
              onChange={(e) => setRulePoints(e.target.value)}
              className="max-w-[80px]"
            />
            <Input
              placeholder="Min purchase ($)"
              value={ruleMinPurchase}
              onChange={(e) => setRuleMinPurchase(e.target.value)}
              className="max-w-[120px]"
            />
            <Input
              placeholder="Branch ID (optional)"
              value={ruleBranchId}
              onChange={(e) => setRuleBranchId(e.target.value)}
              className="max-w-[140px]"
            />
            <Input
              placeholder="Min lifetime pts"
              value={ruleMinLifetime}
              onChange={(e) => setRuleMinLifetime(e.target.value)}
              className="max-w-[120px]"
            />
            <Button
              onClick={() => createRule.mutate()}
              disabled={!ruleName || createRule.isPending}
            >
              Add rule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
