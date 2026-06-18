'use client';

import { useQuery } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PointsReport {
  byType: Array<{
    type: string;
    _sum: { points: number | null };
    _count: { _all: number };
  }>;
}

interface DashboardData {
  kpis: {
    totalPatrons: number;
    loyaltyMembers: number;
    pointsOutstanding: number;
    lifetimePointsEarned: number;
    redemptionCount: number;
    completedReferrals: number;
    activeCampaigns: number;
  };
}

interface CampaignReport {
  campaigns: Array<{
    id: string;
    name: string;
    trigger: string;
    channel: string;
    status: string;
    sentCount: number;
  }>;
  sendsByStatus: Array<{ status: string; _count: { _all: number } }>;
}

interface ChurnReport {
  distribution: Array<{
    churnRisk: string;
    _count: { _all: number };
    _avg: { healthScore: number | null };
  }>;
}

export default function ReportsPage() {
  const token = useAuthStore((s) => s.accessToken);

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'points'],
    queryFn: () => loyaltyGet<PointsReport>('/loyalty/reports/points', token!),
    enabled: !!token,
  });

  const { data: dashboard, isLoading: kpisLoading } = useQuery({
    queryKey: ['loyalty', 'dashboard'],
    queryFn: () => loyaltyGet<DashboardData>('/loyalty/dashboard', token!),
    enabled: !!token,
  });

  const { data: campaignReport, isLoading: campaignsLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'campaigns'],
    queryFn: () => loyaltyGet<CampaignReport>('/loyalty/reports/campaigns', token!),
    enabled: !!token,
  });

  const { data: churnReport, isLoading: churnLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'churn'],
    queryFn: () => loyaltyGet<ChurnReport>('/loyalty/reports/churn', token!),
    enabled: !!token,
  });

  const kpis = dashboard?.kpis;

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Reports & analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpisLoading ? (
          <p className="text-muted-foreground text-sm">Loading KPIs…</p>
        ) : kpis ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total patrons</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{kpis.totalPatrons}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Loyalty members</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{kpis.loyaltyMembers}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Points outstanding</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{kpis.pointsOutstanding}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lifetime earned</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{kpis.lifetimePointsEarned}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Redemptions</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{kpis.redemptionCount}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Referrals completed</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{kpis.completedReferrals}</CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Points ledger by type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reportLoading ? (
            <p className="text-muted-foreground text-sm">Loading report…</p>
          ) : report?.byType.length ? (
            report.byType.map((row) => (
              <div key={row.type} className="flex justify-between text-sm">
                <span>{row.type}</span>
                <span>
                  {row._sum.points ?? 0} pts · {row._count._all} entries
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No ledger activity yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaignsLoading ? (
            <p className="text-muted-foreground text-sm">Loading campaigns…</p>
          ) : (
            <>
              {campaignReport?.sendsByStatus.map((row) => (
                <div key={row.status} className="flex justify-between text-sm">
                  <span>Sends · {row.status}</span>
                  <span>{row._count._all}</span>
                </div>
              ))}
              {campaignReport?.campaigns.slice(0, 10).map((c) => (
                <div key={c.id} className="flex justify-between border-t pt-2 text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.trigger} · {c.sentCount} sent
                  </span>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Churn risk distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {churnLoading ? (
            <p className="text-muted-foreground text-sm">Loading churn report…</p>
          ) : churnReport?.distribution.length ? (
            churnReport.distribution.map((row) => (
              <div key={row.churnRisk} className="flex justify-between text-sm">
                <span>{row.churnRisk}</span>
                <span>
                  {row._count._all} members · avg health{' '}
                  {row._avg.healthScore != null ? Math.round(row._avg.healthScore) : '—'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No loyalty accounts yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
