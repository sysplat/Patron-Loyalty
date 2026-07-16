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
import { Trophy, Medal, Target } from 'lucide-react';
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
  <div className="flex flex-col items-center justify-center py-6 text-center">
    <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
      <Icon className="text-muted-foreground/50 h-5 w-5" />
    </div>
    <p className="text-sm font-medium">{title}</p>
    <p className="text-muted-foreground mt-1 max-w-[200px] text-xs">{description}</p>
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
      toast.success('Badge created');
      setBadgeName('');
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
      toast.success('Challenge created');
      setChallengeName('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'challenges'] });
    },
    onError: () => toast.error('Could not create challenge'),
  });

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Gamification</h1>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Badges award automatically when patrons meet criteria. Challenges track visit goals and
        grant bonus points on completion. Patrons also see a digital stamp card on their portal (SRS
        §13).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Points leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leaderboardLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : leaderboard.length ? (
            leaderboard.map((row) => (
              <div key={row.rank} className="flex justify-between text-sm">
                <span>
                  #{row.rank} {row.patronName}
                  {row.tier ? ` · ${row.tier.name}` : ''}
                </span>
                <span className="text-muted-foreground">
                  {row.lifetimePointsEarned} pts · {row.totalVisits} visits
                </span>
              </div>
            ))
          ) : (
            <EmptyState
              icon={Trophy}
              title="No members yet"
              description="As customers join and earn points, they will appear here."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Badges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Badge name"
              value={badgeName}
              onChange={(e) => setBadgeName(e.target.value)}
              className="max-w-xs"
            />
            <Input
              placeholder="Min visits"
              value={badgeMinVisits}
              onChange={(e) => setBadgeMinVisits(e.target.value)}
              className="max-w-[100px]"
            />
            <Button
              onClick={() => createBadge.mutate()}
              disabled={!badgeName || createBadge.isPending}
            >
              Add badge
            </Button>
          </div>
          {badgesLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : badges.length > 0 ? (
            <div className="mt-4 space-y-2">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className="flex justify-between border-t pt-2 text-sm first:border-0 first:pt-0"
                >
                  <span>{b.name}</span>
                  <span className="text-muted-foreground">{b.description ?? 'Auto-award'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 border-t pt-4">
              <EmptyState
                icon={Medal}
                title="No badges created"
                description="Reward loyal customers by defining visit milestones."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Challenges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Challenge name"
              value={challengeName}
              onChange={(e) => setChallengeName(e.target.value)}
              className="max-w-xs"
            />
            <Input
              placeholder="Target visits"
              value={challengeTarget}
              onChange={(e) => setChallengeTarget(e.target.value)}
              className="max-w-[100px]"
            />
            <Input
              placeholder="Reward pts"
              value={challengeReward}
              onChange={(e) => setChallengeReward(e.target.value)}
              className="max-w-[100px]"
            />
            <Button
              onClick={() => createChallenge.mutate()}
              disabled={!challengeName || createChallenge.isPending}
            >
              Add challenge
            </Button>
          </div>
          {challengesLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : challenges.length > 0 ? (
            <div className="mt-4 space-y-2">
              {challenges.map((c) => (
                <div
                  key={c.id}
                  className="flex justify-between border-t pt-2 text-sm first:border-0 first:pt-0"
                >
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.targetValue} {c.targetType.toLowerCase()} · {c.rewardPoints} pts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 border-t pt-4">
              <EmptyState
                icon={Target}
                title="No challenges configured"
                description="Give customers goals to hit to increase engagement."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
