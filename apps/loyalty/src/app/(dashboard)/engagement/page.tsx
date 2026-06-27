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
            <p className="text-muted-foreground text-sm">Loading…</p>
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
            <p className="text-muted-foreground text-sm">No loyalty members yet.</p>
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
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="space-y-2">
              {badges.map((b) => (
                <div key={b.id} className="flex justify-between text-sm">
                  <span>{b.name}</span>
                  <span className="text-muted-foreground">{b.description ?? 'Auto-award'}</span>
                </div>
              ))}
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
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <div className="space-y-2">
              {challenges.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.targetValue} {c.targetType.toLowerCase()} · {c.rewardPoints} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
