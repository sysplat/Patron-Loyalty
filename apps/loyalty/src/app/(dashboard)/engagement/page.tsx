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
import { Trophy, Medal, Target, Plus } from 'lucide-react';
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
  <div className="bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
    <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
      <Icon className="text-muted-foreground/60 h-6 w-6" />
    </div>
    <p className="text-base font-semibold">{title}</p>
    <p className="text-muted-foreground mt-1 max-w-[220px] text-sm">{description}</p>
  </div>
);

interface Badge {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
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

export default function EngagementPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  // Modal states
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  // Form states
  const [badgeName, setBadgeName] = useState('');
  const [badgeMinVisits, setBadgeMinVisits] = useState('5');
  const [challengeName, setChallengeName] = useState('');
  const [challengeTarget, setChallengeTarget] = useState('3');
  const [challengeReward, setChallengeReward] = useState('50');

  const { data: badges = [], isLoading: badgesLoading } = useQuery({
    queryKey: ['loyalty', 'badges'],
    queryFn: () => loyaltyGet<Badge[]>('/loyalty/badges', token!),
    enabled: !!token,
  });

  const { data: challenges = [], isLoading: challengesLoading } = useQuery({
    queryKey: ['loyalty', 'challenges'],
    queryFn: () => loyaltyGet<Challenge[]>('/loyalty/challenges', token!),
    enabled: !!token,
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ['loyalty', 'leaderboard'],
    queryFn: () => loyaltyGet<LeaderboardRow[]>('/loyalty/leaderboard?limit=15', token!),
    enabled: !!token,
  });

  const createBadge = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/badges', token!, {
        name: badgeName,
        criteria: { minVisits: Number(badgeMinVisits) },
        active: true,
      }),
    onSuccess: () => {
      toast.success('Badge created successfully!');
      setBadgeName('');
      setIsBadgeModalOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'badges'] });
    },
    onError: () => toast.error('Could not create badge'),
  });

  const createChallenge = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/challenges', token!, {
        name: challengeName,
        targetType: 'VISITS',
        targetValue: Number(challengeTarget),
        rewardPoints: Number(challengeReward),
        active: true,
      }),
    onSuccess: () => {
      toast.success('Challenge created successfully!');
      setChallengeName('');
      setIsChallengeModalOpen(false);
      qc.invalidateQueries({ queryKey: ['loyalty', 'challenges'] });
    },
    onError: () => toast.error('Could not create challenge'),
  });

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (rank === 2) return 'bg-slate-100 text-slate-700 border-slate-200';
    if (rank === 3) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-muted text-muted-foreground border-transparent';
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Gamification</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Drive customer engagement with automatic badges and visit challenges. Your most loyal
          patrons will climb the points leaderboard.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Leaderboard */}
        <div className="space-y-6 lg:col-span-7">
          <Card className="border-muted/50 overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/20 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="text-primary h-5 w-5" />
                Points Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboardLoading ? (
                <div className="space-y-4 p-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : leaderboard.length ? (
                <div className="divide-border divide-y">
                  {leaderboard.map((row) => (
                    <div
                      key={row.rank}
                      className="hover:bg-muted/30 flex items-center justify-between p-4 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold shadow-sm ${getRankColor(
                            row.rank,
                          )}`}
                        >
                          #{row.rank}
                        </div>
                        <div>
                          <p className="text-foreground flex items-center gap-2 font-semibold">
                            {row.patronName}
                            {row.tier && (
                              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                {row.tier.name}
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground text-xs font-medium">
                            {row.totalVisits} total visits
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {row.lifetimePointsEarned.toLocaleString()}
                        </p>
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Points
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={Trophy}
                    title="No members yet"
                    description="As customers join and earn points, they will appear here."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Badges & Challenges */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="border-muted/50 shadow-sm">
            <CardHeader className="bg-muted/20 flex flex-row items-center justify-between space-y-0 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Medal className="h-5 w-5 text-indigo-500" />
                Badges
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setIsBadgeModalOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Badge
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              {badgesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : badges.length > 0 ? (
                <div className="space-y-3">
                  {badges.map((b) => (
                    <div
                      key={b.id}
                      className="bg-card group flex items-center gap-4 rounded-lg border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 transition-colors group-hover:bg-indigo-500">
                        <Medal className="h-5 w-5 text-indigo-600 transition-colors group-hover:text-white" />
                      </div>
                      <div>
                        <p className="text-foreground font-semibold">{b.name}</p>
                        <p className="text-muted-foreground text-xs font-medium">
                          {b.description ?? 'Auto-award'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Medal}
                  title="No badges created"
                  description="Reward loyal customers by defining visit milestones."
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-muted/50 shadow-sm">
            <CardHeader className="bg-muted/20 flex flex-row items-center justify-between space-y-0 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-emerald-500" />
                Challenges
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setIsChallengeModalOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Challenge
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              {challengesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : challenges.length > 0 ? (
                <div className="space-y-3">
                  {challenges.map((c) => (
                    <div
                      key={c.id}
                      className="bg-card group flex items-center gap-4 rounded-lg border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 transition-colors group-hover:bg-emerald-500">
                        <Target className="h-5 w-5 text-emerald-600 transition-colors group-hover:text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground font-semibold">{c.name}</p>
                        <p className="text-muted-foreground text-xs font-medium">
                          {c.targetValue} {c.targetType.toLowerCase()} to complete
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          +{c.rewardPoints} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Target}
                  title="No challenges configured"
                  description="Give customers goals to hit to increase engagement."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Badge Creation Modal */}
      {isBadgeModalOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="animate-in zoom-in-95 w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle>Create New Badge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Badge Name</label>
                <Input
                  placeholder="e.g. VIP Member"
                  value={badgeName}
                  onChange={(e) => setBadgeName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Visits Required</label>
                <Input
                  type="number"
                  placeholder="5"
                  value={badgeMinVisits}
                  onChange={(e) => setBadgeMinVisits(e.target.value)}
                />
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsBadgeModalOpen(false)}
                  disabled={createBadge.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createBadge.mutate()}
                  disabled={!badgeName || !badgeMinVisits || createBadge.isPending}
                >
                  {createBadge.isPending ? 'Creating...' : 'Create Badge'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Challenge Creation Modal */}
      {isChallengeModalOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="animate-in zoom-in-95 w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle>Create New Challenge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Challenge Name</label>
                <Input
                  placeholder="e.g. Weekend Warrior"
                  value={challengeName}
                  onChange={(e) => setChallengeName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Visits</label>
                  <Input
                    type="number"
                    placeholder="3"
                    value={challengeTarget}
                    onChange={(e) => setChallengeTarget(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reward Points</label>
                  <Input
                    type="number"
                    placeholder="50"
                    value={challengeReward}
                    onChange={(e) => setChallengeReward(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsChallengeModalOpen(false)}
                  disabled={createChallenge.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createChallenge.mutate()}
                  disabled={
                    !challengeName ||
                    !challengeTarget ||
                    !challengeReward ||
                    createChallenge.isPending
                  }
                >
                  {createChallenge.isPending ? 'Creating...' : 'Create Challenge'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
