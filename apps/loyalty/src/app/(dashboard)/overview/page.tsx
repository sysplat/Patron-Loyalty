'use client';

import { useQuery } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardData {
  kpis: {
    totalPatrons: number;
    loyaltyMembers: number;
    pointsOutstanding: number;
    lifetimePointsEarned: number;
    totalVisits: number;
    avgHealthScore: number;
    redemptionCount: number;
    completedReferrals: number;
    activeCampaigns: number;
  };
  tierDistribution: Array<{ tierId: string | null; count: number; tier: { name: string } | null }>;
  recentActivity: Array<{
    id: string;
    type: string;
    points: number;
    description: string | null;
    patronName: string;
    createdAt: string;
  }>;
}

export default function LoyaltyDashboardPage() {
  const token = useAuthStore((s) => s.accessToken);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['loyalty', 'dashboard'],
    queryFn: () => loyaltyGet<DashboardData>('/loyalty/dashboard', token!),
    enabled: !!token,
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Loading loyalty dashboard…</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Could not load dashboard{(error as Error)?.message ? `: ${(error as Error).message}` : '.'}
      </p>
    );
  }

  if (!data) return null;

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Loyalty Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Executive KPIs across patrons, points, and campaigns.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Patrons', k.totalPatrons],
          ['Members', k.loyaltyMembers],
          ['Points outstanding', k.pointsOutstanding],
          ['Lifetime earned', k.lifetimePointsEarned],
          ['Total visits', k.totalVisits],
          ['Avg health score', k.avgHealthScore],
          ['Redemptions', k.redemptionCount],
          ['Referrals', k.completedReferrals],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tier distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.tierDistribution.map((row) => (
              <div key={row.tierId ?? 'none'} className="flex justify-between text-sm">
                <span>{row.tier?.name ?? 'Unassigned'}</span>
                <span className="font-medium">{row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent points activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity yet.</p>
            ) : (
              data.recentActivity.map((item) => (
                <div key={item.id} className="flex justify-between gap-2 text-sm">
                  <span>
                    {item.patronName} · {item.description ?? item.type}
                  </span>
                  <span className={item.points >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {item.points > 0 ? '+' : ''}
                    {item.points}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
