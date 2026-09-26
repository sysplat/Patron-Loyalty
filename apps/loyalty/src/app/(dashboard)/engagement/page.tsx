'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPost } from '@/lib/api-response';
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
import { BookOpen, ChevronDown, ChevronUp, Plus } from 'lucide-react';

type ViewTab = 'badges' | 'challenges' | 'leaderboard';
type BadgeCriterion = 'minVisits' | 'minPoints';
type ChallengeTarget = 'VISITS' | 'POINTS_EARNED' | 'REFERRALS';

interface LoyaltyBadge {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  criteria?: { minVisits?: number; minPoints?: number } | null;
}

interface Challenge {
  id: string;
  name: string;
  description?: string | null;
  targetType: string;
  targetValue: number;
  rewardPoints: number;
}

interface LeaderboardRow {
  rank: number;
  patronName: string;
  lifetimePointsEarned: number;
  totalVisits: number;
  tier?: { name: string } | null;
}

const TABS: { id: ViewTab; label: string }[] = [
  { id: 'badges', label: 'Badges' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

const TARGET_META: Record<ChallengeTarget, { label: string; unit: string; hint: string }> = {
  VISITS: {
    label: 'Visits',
    unit: 'visits',
    hint: 'Advances on Counter purchases and linked queue/appointment visits.',
  },
  POINTS_EARNED: {
    label: 'Points earned',
    unit: 'points',
    hint: 'Advances by the points awarded on each earn (purchase, visit, review).',
  },
  REFERRALS: {
    label: 'Referrals',
    unit: 'completed referrals',
    hint: 'Advances for the advocate when a friend’s referral completes (first purchase).',
  },
};

function selectClassName(className?: string) {
  return cn(
    'border-input bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  );
}

function badgeRuleLabel(badge: LoyaltyBadge): string {
  const c = badge.criteria ?? {};
  const parts: string[] = [];
  if (typeof c.minVisits === 'number') parts.push(`${c.minVisits}+ visits`);
  if (typeof c.minPoints === 'number') parts.push(`${c.minPoints.toLocaleString()}+ lifetime pts`);
  if (parts.length) return parts.join(' · ');
  return badge.description?.trim() || 'No rule set';
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

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card>
      <CardContent className="px-6 py-12 text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
          {body}
        </p>
        {actionLabel && onAction ? (
          <Button type="button" size="sm" className="mt-5" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function EngagementPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const [tab, setTab] = useState<ViewTab>('badges');
  const [guideOpen, setGuideOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [badgeName, setBadgeName] = useState('');
  const [badgeDescription, setBadgeDescription] = useState('');
  const [badgeCriterion, setBadgeCriterion] = useState<BadgeCriterion>('minVisits');
  const [badgeThreshold, setBadgeThreshold] = useState('5');

  const [challengeName, setChallengeName] = useState('');
  const [challengeDescription, setChallengeDescription] = useState('');
  const [challengeTargetType, setChallengeTargetType] = useState<ChallengeTarget>('VISITS');
  const [challengeTarget, setChallengeTarget] = useState('5');
  const [challengeReward, setChallengeReward] = useState('50');

  const { data: badges = [], isLoading: badgesLoading } = useQuery({
    queryKey: ['loyalty', 'badges'],
    queryFn: () => loyaltyGet<LoyaltyBadge[]>('/loyalty/badges', token!),
    enabled: !!token,
  });

  const { data: challenges = [], isLoading: challengesLoading } = useQuery({
    queryKey: ['loyalty', 'challenges'],
    queryFn: () => loyaltyGet<Challenge[]>('/loyalty/challenges', token!),
    enabled: !!token,
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ['loyalty', 'leaderboard'],
    queryFn: () => loyaltyGet<LeaderboardRow[]>('/loyalty/leaderboard?limit=20', token!),
    enabled: !!token,
  });

  const stats = useMemo(
    () => [
      { label: 'Active badges', value: badges.length },
      { label: 'Active challenges', value: challenges.length },
      {
        label: 'Top score',
        value: leaderboard[0]?.lifetimePointsEarned?.toLocaleString() ?? '—',
      },
      { label: 'On leaderboard', value: leaderboard.length },
    ],
    [badges.length, challenges.length, leaderboard],
  );

  const createLabel =
    tab === 'badges' ? 'New badge' : tab === 'challenges' ? 'New challenge' : 'New badge';

  const createBadge = useMutation({
    mutationFn: () => {
      const threshold = Number(badgeThreshold);
      const criteria =
        badgeCriterion === 'minVisits' ? { minVisits: threshold } : { minPoints: threshold };
      return loyaltyPost('/loyalty/badges', token!, {
        name: badgeName.trim(),
        description: badgeDescription.trim() || null,
        criteria,
      });
    },
    onSuccess: () => {
      toast.success('Badge saved');
      setBadgeName('');
      setBadgeDescription('');
      setBadgeThreshold('5');
      setBadgeCriterion('minVisits');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'badges'] });
    },
    onError: () => toast.error('Could not save badge'),
  });

  const createChallenge = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/challenges', token!, {
        name: challengeName.trim(),
        description: challengeDescription.trim() || null,
        targetType: challengeTargetType,
        targetValue: Number(challengeTarget),
        rewardPoints: Number(challengeReward),
      }),
    onSuccess: () => {
      toast.success('Challenge saved');
      setChallengeName('');
      setChallengeDescription('');
      setChallengeTargetType('VISITS');
      setChallengeTarget('5');
      setChallengeReward('50');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'challenges'] });
    },
    onError: () => toast.error('Could not save challenge'),
  });

  const targetInfo = TARGET_META[challengeTargetType];

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Achievements</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Badges and challenges that reward loyal patrons — plus who is climbing the points
            leaderboard.
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
          {tab !== 'leaderboard' ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" />
              {createOpen ? 'Close' : createLabel}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setTab('badges');
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New badge
            </Button>
          )}
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Staff guide</CardTitle>
            <CardDescription>
              Three tools — each does a different job. Nothing here sends SMS or email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-3">
              <li className="space-y-1">
                <p className="text-foreground font-medium">Badges</p>
                <p className="text-xs leading-relaxed">
                  Lifetime milestones. Example: “Regular” at 10 visits. Auto-awarded when the patron
                  meets the rule — shown in their portal.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">Challenges</p>
                <p className="text-xs leading-relaxed">
                  Goals with a points payout. Example: “5 visits → 50 pts.” Visit challenges advance
                  on Counter purchases; points and referral challenges track those activities.
                </p>
              </li>
              <li className="space-y-1">
                <p className="text-foreground font-medium">Leaderboard</p>
                <p className="text-xs leading-relaxed">
                  Read-only ranking by lifetime points. Use it to spot VIPs — not to configure
                  rewards.
                </p>
              </li>
            </ol>
            <p className="border-border/70 text-muted-foreground border-t pt-3 text-xs leading-relaxed">
              Points earn rules live under{' '}
              <Link
                href="/program"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                Program
              </Link>
              . Message blasts live under{' '}
              <Link
                href="/campaigns"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                Campaigns
              </Link>
              . This page only configures achievements patrons earn by visiting and spending.
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

      {createOpen && tab !== 'leaderboard' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {tab === 'badges' ? 'New badge' : 'New challenge'}
            </CardTitle>
            <CardDescription>
              {tab === 'badges'
                ? 'Patrons earn this automatically when they hit the threshold.'
                : 'Patrons progress toward the goal and receive bonus points when complete.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (tab === 'badges') {
                  if (!badgeName.trim()) {
                    toast.error('Add a badge name');
                    return;
                  }
                  if (!badgeThreshold || Number(badgeThreshold) < 1) {
                    toast.error('Set a threshold of at least 1');
                    return;
                  }
                  createBadge.mutate();
                  return;
                }
                if (!challengeName.trim()) {
                  toast.error('Add a challenge name');
                  return;
                }
                if (!challengeTarget || Number(challengeTarget) < 1) {
                  toast.error('Set a target of at least 1');
                  return;
                }
                createChallenge.mutate();
              }}
            >
              {tab === 'badges' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="badge-name">Name</Label>
                      <Input
                        id="badge-name"
                        value={badgeName}
                        onChange={(e) => setBadgeName(e.target.value)}
                        placeholder="Regular"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="badge-criterion">Award when</Label>
                      <select
                        id="badge-criterion"
                        value={badgeCriterion}
                        onChange={(e) => setBadgeCriterion(e.target.value as BadgeCriterion)}
                        className={selectClassName()}
                      >
                        <option value="minVisits">Lifetime visits reach…</option>
                        <option value="minPoints">Lifetime points reach…</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="badge-threshold">
                        {badgeCriterion === 'minVisits' ? 'Visit count' : 'Points total'}
                      </Label>
                      <Input
                        id="badge-threshold"
                        type="number"
                        min={1}
                        value={badgeThreshold}
                        onChange={(e) => setBadgeThreshold(e.target.value)}
                        className="max-w-[160px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="badge-description">
                      Description{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <textarea
                      id="badge-description"
                      rows={8}
                      value={badgeDescription}
                      onChange={(e) => setBadgeDescription(e.target.value)}
                      placeholder="Shown in the patron portal — keep it short."
                      className="border-input bg-background focus-visible:ring-ring min-h-[180px] w-full rounded-md border px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="challenge-name">Name</Label>
                      <Input
                        id="challenge-name"
                        value={challengeName}
                        onChange={(e) => setChallengeName(e.target.value)}
                        placeholder="Five-visit bonus"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="challenge-target-type">Goal type</Label>
                      <select
                        id="challenge-target-type"
                        value={challengeTargetType}
                        onChange={(e) => setChallengeTargetType(e.target.value as ChallengeTarget)}
                        className={selectClassName()}
                      >
                        {(Object.keys(TARGET_META) as ChallengeTarget[]).map((key) => (
                          <option key={key} value={key}>
                            {TARGET_META[key].label}
                          </option>
                        ))}
                      </select>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {targetInfo.hint}
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="challenge-target">Target ({targetInfo.unit})</Label>
                        <Input
                          id="challenge-target"
                          type="number"
                          min={1}
                          value={challengeTarget}
                          onChange={(e) => setChallengeTarget(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="challenge-reward">Reward points</Label>
                        <Input
                          id="challenge-reward"
                          type="number"
                          min={0}
                          value={challengeReward}
                          onChange={(e) => setChallengeReward(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="challenge-description">
                      Description{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <textarea
                      id="challenge-description"
                      rows={8}
                      value={challengeDescription}
                      onChange={(e) => setChallengeDescription(e.target.value)}
                      placeholder="Explain the goal to the patron…"
                      className="border-input bg-background focus-visible:ring-ring min-h-[180px] w-full rounded-md border px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="submit" disabled={createBadge.isPending || createChallenge.isPending}>
                  {createBadge.isPending || createChallenge.isPending ? 'Saving…' : 'Save'}
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
          {TABS.map((item) => {
            const count =
              item.id === 'badges'
                ? badges.length
                : item.id === 'challenges'
                  ? challenges.length
                  : leaderboard.length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setCreateOpen(false);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === item.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
                <span className="tabular-nums opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          {tab === 'badges'
            ? 'Lifetime milestones · auto-awarded'
            : tab === 'challenges'
              ? 'Goals with a points payout'
              : 'Top patrons by lifetime points'}
        </p>
      </div>

      {tab === 'badges' ? (
        badgesLoading ? (
          <ListSkeleton />
        ) : badges.length === 0 ? (
          <EmptyState
            title="No badges yet"
            body="Create a badge for a visit or points milestone. Patrons see earned badges in their portal."
            actionLabel="New badge"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Badge</th>
                    <th className="px-4 py-2.5 font-medium">Rule</th>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {badges.map((b) => (
                    <tr
                      key={b.id}
                      className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium">{b.name}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="secondary" className="font-normal">
                          {badgeRuleLabel(b)}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground max-w-[320px] px-4 py-3 align-top text-xs">
                        {b.description?.trim() || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      {tab === 'challenges' ? (
        challengesLoading ? (
          <ListSkeleton />
        ) : challenges.length === 0 ? (
          <EmptyState
            title="No challenges yet"
            body="Give patrons a clear goal and a points reward when they finish — for example five visits for 50 points."
            actionLabel="New challenge"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Challenge</th>
                    <th className="px-4 py-2.5 font-medium">Goal</th>
                    <th className="px-4 py-2.5 font-medium">Reward</th>
                    <th className="px-4 py-2.5 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((c) => {
                    const meta = TARGET_META[c.targetType as ChallengeTarget];
                    return (
                      <tr
                        key={c.id}
                        className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                      >
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium">{c.name}</p>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <span className="font-medium">
                            {c.targetValue} {meta?.unit ?? c.targetType.toLowerCase()}
                          </span>
                          <span className="text-muted-foreground">
                            {' '}
                            · {meta?.label ?? c.targetType}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums">
                          +{c.rewardPoints.toLocaleString()} pts
                        </td>
                        <td className="text-muted-foreground max-w-[280px] px-4 py-3 align-top text-xs">
                          {c.description?.trim() || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      {tab === 'leaderboard' ? (
        leaderboardLoading ? (
          <ListSkeleton />
        ) : leaderboard.length === 0 ? (
          <EmptyState
            title="Leaderboard is empty"
            body="Patrons appear here as they earn lifetime points from Counter, POS, or linked visits."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border/70 bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Rank</th>
                    <th className="px-4 py-2.5 font-medium">Patron</th>
                    <th className="px-4 py-2.5 font-medium">Tier</th>
                    <th className="px-4 py-2.5 font-medium">Visits</th>
                    <th className="px-4 py-2.5 font-medium">Lifetime points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={`${row.rank}-${row.patronName}`}
                      className="border-border/60 hover:bg-muted/20 border-b last:border-0"
                    >
                      <td className="px-4 py-3 align-middle tabular-nums">
                        <span
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                            row.rank === 1 &&
                              'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
                            row.rank === 2 &&
                              'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
                            row.rank === 3 &&
                              'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100',
                            row.rank > 3 && 'bg-muted text-muted-foreground',
                          )}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle font-medium">{row.patronName}</td>
                      <td className="px-4 py-3 align-middle">
                        {row.tier?.name ? (
                          <Badge variant="outline" className="font-normal">
                            {row.tier.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-4 py-3 align-middle tabular-nums">
                        {row.totalVisits.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-middle font-medium tabular-nums">
                        {row.lifetimePointsEarned.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}
    </div>
  );
}
