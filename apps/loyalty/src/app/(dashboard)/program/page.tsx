'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch, loyaltyPost } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus,
  Settings,
  Target,
  Coins,
  Users,
  Clock,
  CheckCircle2,
  Sparkles,
  Store,
} from 'lucide-react';

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

  // Settings
  const [currencyName, setCurrencyName] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState('');
  const [defaultLocale] = useState('');
  const [defaultEarn, setDefaultEarn] = useState('');
  const [expiryDays, setExpiryDays] = useState('');

  // Tiers
  const [tierName, setTierName] = useState('');
  const [tierSlug, setTierSlug] = useState('');
  const [tierMinPoints, setTierMinPoints] = useState('');

  // Rules Builder State
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleEvent, setRuleEvent] = useState('PURCHASE');
  const [rulePoints, setRulePoints] = useState('');

  // Rule Conditions
  const [condMinPurchase, setCondMinPurchase] = useState('');
  const [condBranchId, setCondBranchId] = useState('');
  const [condIsFirstVisit, setCondIsFirstVisit] = useState(false);
  const [condMinVisits30Days, setCondMinVisits30Days] = useState('');

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
      toast.success('Program updated successfully');
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
      toast.success('Membership tier created');
      setTierName('');
      setTierSlug('');
      setTierMinPoints('');
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
      if (condMinPurchase) conditions.minPurchaseCents = Number(condMinPurchase) * 100;
      if (condBranchId.trim()) conditions.branchId = condBranchId.trim();
      if (condIsFirstVisit) conditions.isFirstVisit = true;
      if (condMinVisits30Days) conditions.minVisits30Days = Number(condMinVisits30Days);

      return loyaltyPost('/loyalty/program/earn-rules', token!, {
        name: ruleName,
        eventType: ruleEvent,
        points: Number(rulePoints),
        active: true,
        ...(Object.keys(conditions).length ? { conditions } : {}),
      });
    },
    onSuccess: () => {
      toast.success('Loyalty rule created and activated');
      setRuleName('');
      setRulePoints('');
      setCondMinPurchase('');
      setCondBranchId('');
      setCondIsFirstVisit(false);
      setCondMinVisits30Days('');
      setShowRuleBuilder(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
    },
    onError: () => toast.error('Could not create rule'),
  });

  if (isLoading)
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading engine...</p>
      </div>
    );
  if (isError || !program) {
    return <p className="text-destructive text-sm">Could not load program.</p>;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Rewards Engine</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure how customers earn points across your business.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {program.enabled ? (
            <Badge className="px-3 py-1">Engine Active</Badge>
          ) : (
            <Badge variant="secondary" className="px-3 py-1">
              Engine Paused
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateProgram.mutate({ enabled: !program.enabled })}
          >
            {program.enabled ? 'Pause Program' : 'Activate Program'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Rules & Tiers */}
        <div className="space-y-6 lg:col-span-2">
          {/* EARN RULES */}
          <Card className="border-primary/10 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="text-primary h-5 w-5" />
                  Earning Rules
                </CardTitle>
                <CardDescription>
                  Rules that determine how and when patrons earn points.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setShowRuleBuilder(!showRuleBuilder)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> New Rule
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* RULE BUILDER UI */}
              {showRuleBuilder && (
                <div className="bg-muted/40 mb-6 rounded-xl border p-5 shadow-inner">
                  <h3 className="mb-4 text-sm font-semibold">Rule Builder</h3>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground text-xs font-medium">
                          Rule Name
                        </label>
                        <Input
                          placeholder="e.g. First Visit Bonus"
                          value={ruleName}
                          onChange={(e) => setRuleName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground text-xs font-medium">
                          Points to Award
                        </label>
                        <Input
                          type="number"
                          placeholder="30"
                          value={rulePoints}
                          onChange={(e) => setRulePoints(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-medium">
                        Trigger Event
                      </label>
                      <select
                        value={ruleEvent}
                        onChange={(e) => setRuleEvent(e.target.value)}
                        className="border-input bg-background w-full rounded-md border p-2 text-sm shadow-sm outline-none focus:ring-1"
                      >
                        <option value="PURCHASE">Every Purchase</option>
                        <option value="TICKET_COMPLETED">Ticket Completed (Walk-in)</option>
                        <option value="APPOINTMENT_COMPLETED">Appointment Completed</option>
                        <option value="REVIEW_SUBMITTED">Review Submitted</option>
                        <option value="REFERRAL_COMPLETED">Referral Completed</option>
                      </select>
                    </div>

                    <div className="border-t pt-4">
                      <label className="text-muted-foreground mb-3 block text-xs font-medium uppercase tracking-wider">
                        Conditions (Optional)
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* First Visit Condition */}
                        <div
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${condIsFirstVisit ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/50'}`}
                          onClick={() => setCondIsFirstVisit(!condIsFirstVisit)}
                        >
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${condIsFirstVisit ? 'bg-primary border-primary' : ''}`}
                          >
                            {condIsFirstVisit && (
                              <CheckCircle2 className="text-primary-foreground h-4 w-4" />
                            )}
                          </div>
                          <div className="text-sm">
                            <p className="font-medium">First Time Visit</p>
                            <p className="text-muted-foreground text-xs">
                              Customer has 0 previous visits.
                            </p>
                          </div>
                        </div>

                        {/* Minimum Spend */}
                        <div className="bg-background space-y-2 rounded-lg border p-3">
                          <p className="text-sm font-medium">Minimum Spend ($)</p>
                          <Input
                            placeholder="e.g. 50"
                            value={condMinPurchase}
                            onChange={(e) => setCondMinPurchase(e.target.value)}
                            className="h-8"
                          />
                        </div>

                        {/* Frequency Condition */}
                        <div className="bg-background space-y-2 rounded-lg border p-3">
                          <p className="text-sm font-medium">Visit Frequency</p>
                          <p className="text-muted-foreground text-[10px]">
                            Min visits in last 30 days
                          </p>
                          <Input
                            placeholder="e.g. 2"
                            value={condMinVisits30Days}
                            onChange={(e) => setCondMinVisits30Days(e.target.value)}
                            className="h-8"
                          />
                        </div>

                        {/* Branch Specific */}
                        <div className="bg-background space-y-2 rounded-lg border p-3">
                          <p className="text-sm font-medium">Specific Branch</p>
                          <p className="text-muted-foreground text-[10px]">
                            Leave blank for all branches
                          </p>
                          <Input
                            placeholder="Branch ID"
                            value={condBranchId}
                            onChange={(e) => setCondBranchId(e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" onClick={() => setShowRuleBuilder(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createRule.mutate()}
                        disabled={!ruleName || !rulePoints || createRule.isPending}
                      >
                        Save Rule
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* LIST OF RULES */}
              <div className="space-y-3">
                {program.earnRules.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    No rules defined yet.
                  </p>
                ) : (
                  program.earnRules.map((r) => {
                    const cond = (r.conditions ?? {}) as Record<string, unknown>;
                    const condTags = [];
                    if (cond.isFirstVisit) condTags.push('First Visit');
                    if (cond.minPurchaseCents)
                      condTags.push(`Min $${Number(cond.minPurchaseCents) / 100}`);
                    if (cond.minVisits30Days) condTags.push(`>${cond.minVisits30Days} visits/30d`);
                    if (cond.branchId) condTags.push('Branch Specific');

                    return (
                      <div
                        key={r.id}
                        className={`flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center ${!r.active ? 'bg-muted/30 opacity-70' : 'bg-background shadow-sm'}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{r.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              +{r.points} pts
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" /> {r.eventType}
                            </span>
                            {condTags.map((tag, i) => (
                              <span
                                key={i}
                                className="bg-primary/10 text-primary flex items-center gap-1 rounded px-1.5 py-0.5 font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={r.active ? 'outline' : 'secondary'}
                          onClick={() => toggleRule.mutate({ id: r.id, active: !r.active })}
                          disabled={toggleRule.isPending}
                        >
                          {r.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* TIERS */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="text-primary h-5 w-5" />
                Membership Tiers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {program.tiers.map((t) => (
                  <div key={t.id} className="rounded-lg border p-4 text-center">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t.minLifetimePoints}+ lifetime pts
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <Input
                  placeholder="Tier Name (e.g. Platinum)"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  className="h-9 w-full sm:w-[160px]"
                />
                <Input
                  placeholder="Slug (platinum)"
                  value={tierSlug}
                  onChange={(e) => setTierSlug(e.target.value)}
                  className="h-9 w-full sm:w-[120px]"
                />
                <Input
                  placeholder="Min pts (e.g. 1000)"
                  type="number"
                  value={tierMinPoints}
                  onChange={(e) => setTierMinPoints(e.target.value)}
                  className="h-9 w-full sm:w-[120px]"
                />
                <Button
                  size="sm"
                  onClick={() => createTier.mutate()}
                  disabled={!tierName || !tierSlug || createTier.isPending}
                  className="w-full sm:w-auto"
                >
                  Add Tier
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Base Settings */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="text-primary h-5 w-5" />
                Global Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Points Currency Name</label>
                <div className="relative">
                  <Coins className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                  <Input
                    className="pl-9"
                    placeholder="e.g. Stars, Points"
                    defaultValue={program.pointsCurrencyName}
                    onChange={(e) => setCurrencyName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Default Earn Amount</label>
                <div className="relative">
                  <Store className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                  <Input
                    className="pl-9"
                    type="number"
                    placeholder="Base points for unnamed rules"
                    defaultValue={String(program.defaultEarnPoints)}
                    onChange={(e) => setDefaultEarn(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Points Expiry (Days)</label>
                <div className="relative">
                  <Clock className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                  <Input
                    className="pl-9"
                    type="number"
                    placeholder="Leave blank for never"
                    defaultValue={program.pointsExpiryDays ? String(program.pointsExpiryDays) : ''}
                    onChange={(e) => setExpiryDays(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Display Currency</label>
                <Input
                  placeholder="USD, CAD, GBP"
                  defaultValue={program.displayCurrencyCode ?? 'USD'}
                  onChange={(e) => setDisplayCurrency(e.target.value.toUpperCase())}
                />
              </div>

              <Button
                className="w-full"
                onClick={() =>
                  updateProgram.mutate({
                    pointsCurrencyName: currencyName || program.pointsCurrencyName,
                    displayCurrencyCode: displayCurrency || program.displayCurrencyCode || 'USD',
                    defaultLocale: defaultLocale || program.defaultLocale || 'en',
                    defaultEarnPoints: defaultEarn
                      ? Number(defaultEarn)
                      : program.defaultEarnPoints,
                    pointsExpiryDays: expiryDays ? Number(expiryDays) : null,
                  })
                }
                disabled={updateProgram.isPending}
              >
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
