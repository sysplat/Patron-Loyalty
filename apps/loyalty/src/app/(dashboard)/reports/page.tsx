'use client';

import { useQuery } from '@tanstack/react-query';
import { loyaltyGet, loyaltyDownloadCsv } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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

interface GrowthReport {
  monthlyNewPatrons: Array<{ month: string; count: number }>;
}

interface ReferralReport {
  completed: number;
  bonusPointsAwarded: number;
  topReferrers: Array<{ patronName: string; completedCount: number }>;
}

interface RedemptionReport {
  byStatus: Array<{ status: string; _count: { _all: number } }>;
  byReward: Array<{ count: number; reward: { name: string } | null }>;
}

interface VipReport {
  vipCount: number;
  topPatrons: Array<{
    patronName: string;
    lifetimePointsEarned: number;
    tier: { name: string } | null;
  }>;
}

interface BranchReport {
  branches: Array<{ branchId: string; branchName: string; visitCount: number }>;
}

interface CampaignRoiReport {
  campaigns: Array<{
    id: string;
    name: string;
    channel: string;
    sentCount: number;
    sendBreakdown: Array<{ status: string; count: number }>;
  }>;
}

interface SalesDashboard {
  repeatPurchaseRate: number;
  redemptionRate: number;
  avgVisitsPerMember: number;
  totalLifetimeValueCents: number;
  totalLifetimePoints: number;
}

export default function ReportsPage() {
  const token = useAuthStore((s) => s.accessToken);

  const downloadCsv = async (path: string, filename: string) => {
    if (!token) return;
    try {
      await loyaltyDownloadCsv(path, token, filename);
    } catch {
      toast.error('CSV export failed');
    }
  };

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

  const { data: growthReport, isLoading: growthLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'growth'],
    queryFn: () => loyaltyGet<GrowthReport>('/loyalty/reports/growth', token!),
    enabled: !!token,
  });

  const { data: referralReport, isLoading: referralLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'referrals'],
    queryFn: () => loyaltyGet<ReferralReport>('/loyalty/reports/referrals', token!),
    enabled: !!token,
  });

  const { data: redemptionReport, isLoading: redemptionLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'redemptions'],
    queryFn: () => loyaltyGet<RedemptionReport>('/loyalty/reports/redemptions', token!),
    enabled: !!token,
  });

  const { data: vipReport, isLoading: vipLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'vip'],
    queryFn: () => loyaltyGet<VipReport>('/loyalty/reports/vip', token!),
    enabled: !!token,
  });

  const { data: branchReport, isLoading: branchLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'branches'],
    queryFn: () => loyaltyGet<BranchReport>('/loyalty/reports/branches', token!),
    enabled: !!token,
  });

  const { data: roiReport, isLoading: roiLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'campaign-roi'],
    queryFn: () => loyaltyGet<CampaignRoiReport>('/loyalty/reports/campaign-roi', token!),
    enabled: !!token,
  });

  const { data: salesDashboard, isLoading: salesLoading } = useQuery({
    queryKey: ['loyalty', 'reports', 'sales-dashboard'],
    queryFn: () => loyaltyGet<SalesDashboard>('/loyalty/reports/sales-dashboard', token!),
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Points ledger by type</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv('/loyalty/reports/points/export', 'loyalty-points-report.csv')
            }
          >
            Export CSV
          </Button>
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
          <CardTitle>Customer growth (6 months)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {growthLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : growthReport?.monthlyNewPatrons.length ? (
            growthReport.monthlyNewPatrons.map((row) => (
              <div key={row.month} className="flex justify-between text-sm">
                <span>{row.month}</span>
                <span>{row.count} new patrons</span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No patron signups in the last 6 months.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Referral performance</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadCsv('/loyalty/reports/referrals/export', 'loyalty-referrals-report.csv')
            }
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {referralLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : referralReport ? (
            <>
              <div className="flex justify-between text-sm">
                <span>Completed referrals</span>
                <span>{referralReport.completed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Bonus points awarded</span>
                <span>{referralReport.bonusPointsAwarded}</span>
              </div>
              {referralReport.topReferrers.slice(0, 5).map((row) => (
                <div key={row.patronName} className="flex justify-between border-t pt-2 text-sm">
                  <span>{row.patronName}</span>
                  <span className="text-muted-foreground">{row.completedCount} referrals</span>
                </div>
              ))}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reward redemptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {redemptionLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              {redemptionReport?.byStatus.map((row) => (
                <div key={row.status} className="flex justify-between text-sm">
                  <span>{row.status}</span>
                  <span>{row._count._all}</span>
                </div>
              ))}
              {redemptionReport?.byReward.slice(0, 8).map((row) => (
                <div
                  key={row.reward?.name ?? row.count}
                  className="flex justify-between border-t pt-2 text-sm"
                >
                  <span>{row.reward?.name ?? 'Unknown reward'}</span>
                  <span className="text-muted-foreground">{row.count}</span>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>VIP patrons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vipLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : vipReport ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{vipReport.vipCount}</span> VIP members (Gold+ or 5k+
                lifetime points)
              </p>
              {vipReport.topPatrons.map((row) => (
                <div key={row.patronName} className="flex justify-between border-t pt-2 text-sm">
                  <span>
                    {row.patronName}
                    {row.tier ? ` · ${row.tier.name}` : ''}
                  </span>
                  <span className="text-muted-foreground">{row.lifetimePointsEarned} pts</span>
                </div>
              ))}
            </>
          ) : null}
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

      <Card>
        <CardHeader>
          <CardTitle>Branch performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {branchLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : branchReport?.branches.length ? (
            branchReport.branches.map((row) => (
              <div key={row.branchId} className="flex justify-between text-sm">
                <span>{row.branchName}</span>
                <span>{row.visitCount} visits</span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No branch visit data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign ROI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roiLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : roiReport?.campaigns.length ? (
            roiReport.campaigns.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="flex justify-between border-t pt-2 text-sm first:border-0 first:pt-0"
              >
                <span>{c.name}</span>
                <span className="text-muted-foreground">
                  {c.channel} · {c.sentCount} sent
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No campaigns yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {salesLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : salesDashboard ? (
            <>
              <div className="flex justify-between text-sm">
                <span>Repeat purchase rate</span>
                <span>{Math.round(salesDashboard.repeatPurchaseRate * 100)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Redemption rate</span>
                <span>{Math.round(salesDashboard.redemptionRate * 100)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Avg visits per member</span>
                <span>{salesDashboard.avgVisitsPerMember}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total lifetime value</span>
                <span>${(salesDashboard.totalLifetimeValueCents / 100).toFixed(2)}</span>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
