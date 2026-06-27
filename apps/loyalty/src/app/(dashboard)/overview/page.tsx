'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type DashboardView = 'executive' | 'sales' | 'customer' | 'campaign';

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

interface SalesDashboard {
  repeatPurchaseRate: number;
  redemptionRate: number;
  avgVisitsPerMember: number;
  totalLifetimeValueCents: number;
}

interface ChurnReport {
  distribution: Array<{ churnRisk: string; _count: { _all: number } }>;
}

interface CampaignReport {
  campaigns: Array<{ name: string; sentCount: number; status: string }>;
}

export default function LoyaltyDashboardPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [view, setView] = useState<DashboardView>('executive');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['loyalty', 'dashboard'],
    queryFn: () => loyaltyGet<DashboardData>('/loyalty/dashboard', token!),
    enabled: !!token,
  });

  const { data: salesData } = useQuery({
    queryKey: ['loyalty', 'reports', 'sales-dashboard'],
    queryFn: () => loyaltyGet<SalesDashboard>('/loyalty/reports/sales-dashboard', token!),
    enabled: !!token && view === 'sales',
  });

  const { data: churnData } = useQuery({
    queryKey: ['loyalty', 'reports', 'churn'],
    queryFn: () => loyaltyGet<ChurnReport>('/loyalty/reports/churn', token!),
    enabled: !!token && view === 'customer',
  });

  const { data: campaignData } = useQuery({
    queryKey: ['loyalty', 'reports', 'campaigns'],
    queryFn: () => loyaltyGet<CampaignReport>('/loyalty/reports/campaigns', token!),
    enabled: !!token && view === 'campaign',
  });

  const tabClass = (v: DashboardView) =>
    `rounded-md px-3 py-1.5 text-sm ${view === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`;

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
          Executive, sales, customer, and campaign views.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={tabClass('executive')}
          onClick={() => setView('executive')}
        >
          Executive
        </button>
        <button type="button" className={tabClass('sales')} onClick={() => setView('sales')}>
          Sales
        </button>
        <button type="button" className={tabClass('customer')} onClick={() => setView('customer')}>
          Customer
        </button>
        <button type="button" className={tabClass('campaign')} onClick={() => setView('campaign')}>
          Campaign
        </button>
      </div>

      {view === 'executive' && (
        <>
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
                  <CardTitle className="text-muted-foreground text-sm font-medium">
                    {label}
                  </CardTitle>
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
        </>
      )}

      {view === 'sales' && salesData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Repeat purchase rate', `${Math.round(salesData.repeatPurchaseRate * 100)}%`],
            ['Redemption rate', `${Math.round(salesData.redemptionRate * 100)}%`],
            ['Avg visits / member', salesData.avgVisitsPerMember],
            ['Lifetime value', `$${(salesData.totalLifetimeValueCents / 100).toFixed(0)}`],
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
      )}

      {view === 'customer' && (
        <Card>
          <CardHeader>
            <CardTitle>Churn risk distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {churnData?.distribution.map((row) => (
              <div key={row.churnRisk} className="flex justify-between text-sm">
                <span>{row.churnRisk}</span>
                <span>{row._count._all} members</span>
              </div>
            )) ?? <p className="text-muted-foreground text-sm">Loading…</p>}
          </CardContent>
        </Card>
      )}

      {view === 'campaign' && (
        <Card>
          <CardHeader>
            <CardTitle>Active campaigns ({k.activeCampaigns})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {campaignData?.campaigns.slice(0, 10).map((c) => (
              <div key={c.name} className="flex justify-between text-sm">
                <span>{c.name}</span>
                <span className="text-muted-foreground">
                  {c.status} · {c.sentCount} sent
                </span>
              </div>
            )) ?? <p className="text-muted-foreground text-sm">Loading…</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
