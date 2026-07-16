'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { Skeleton } from '@/components/ui/skeleton';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Users,
  Award,
  Coins,
  History,
  Activity,
  HeartPulse,
  Ticket,
  UserPlus,
  X,
  CheckCircle2,
  Circle,
} from 'lucide-react';

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

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#f43f5e'];
const CHURN_COLORS: Record<string, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#f43f5e',
};

function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
}

export default function LoyaltyDashboardPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [view, setView] = useState<DashboardView>('executive');
  const [showOnboarding, setShowOnboarding] = useState(true);

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
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      view === v
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <Skeleton className="h-9 w-[250px]" />
          <Skeleton className="mt-2 h-4 w-[350px]" />
        </div>
        <div className="bg-muted/30 inline-flex gap-1 rounded-lg p-1">
          <Skeleton className="h-8 w-[80px] rounded-md" />
          <Skeleton className="h-8 w-[80px] rounded-md" />
          <Skeleton className="h-8 w-[80px] rounded-md" />
          <Skeleton className="h-8 w-[80px] rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-[60px]" />
                <Skeleton className="mt-2 h-3 w-[120px]" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[150px]" />
            </CardHeader>
            <CardContent>
              <div className="border-muted/40 mx-auto h-[250px] w-[250px] rounded-full border-[20px]" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[180px]" />
            </CardHeader>
            <CardContent className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[120px]" />
                      <Skeleton className="h-3 w-[80px]" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-[40px]" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
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

  const tierChartData = data.tierDistribution.map((r) => ({
    name: r.tier?.name ?? 'Unassigned',
    value: r.count,
  }));

  const churnChartData =
    churnData?.distribution.map((r) => ({
      name: r.churnRisk,
      value: r._count._all,
    })) ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Loyalty Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Executive, sales, customer, and campaign insights.
        </p>
      </div>

      {showOnboarding && (
        <Card className="animate-in fade-in slide-in-from-top-2 border-primary/20 bg-primary/5 relative overflow-hidden">
          <button
            onClick={() => setShowOnboarding(false)}
            className="text-muted-foreground hover:text-foreground absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </button>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Welcome to Patron Loyalty! 👋</CardTitle>
            <p className="text-muted-foreground text-sm">
              Follow these steps to get your program ready for launch.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: 'Create a Reward',
                  desc: 'Add a perk for your patrons',
                  done: true,
                  href: '/rewards',
                },
                {
                  title: 'Setup Portal Branding',
                  desc: 'Add your logo and colors',
                  done: false,
                  href: '/program',
                },
                {
                  title: 'Connect QlessQ',
                  desc: 'Sync historical visits',
                  done: true,
                  href: '/integrations',
                },
                {
                  title: 'Share Referral Link',
                  desc: 'Invite your first customer',
                  done: false,
                  href: '/referrals',
                },
              ].map((step, i) => (
                <Link
                  key={i}
                  href={step.href}
                  className={`hover:border-primary/50 flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    step.done
                      ? 'bg-background/50 border-emerald-500/30'
                      : 'bg-background cursor-pointer'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="text-muted-foreground/30 mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-medium ${step.done ? 'text-foreground' : 'text-primary'}`}
                    >
                      {step.title}
                    </p>
                    <p className="text-muted-foreground text-xs">{step.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-muted/30 inline-flex flex-wrap gap-1 rounded-lg p-1">
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
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Customers', k.totalPatrons, Users, '+12.5%'],
              ['Members', k.loyaltyMembers, Award, '+8.2%'],
              ['Points Outstanding', k.pointsOutstanding, Coins, '+4.1%'],
              ['Lifetime Earned', k.lifetimePointsEarned, History, '+14.2%'],
              ['Total Visits', k.totalVisits, Activity, '+22.4%'],
              ['Avg Health Score', `${k.avgHealthScore}/10`, HeartPulse, '+1.2%'],
              ['Redemptions', k.redemptionCount, Ticket, '+9.4%'],
              ['Referrals', k.completedReferrals, UserPlus, '+18.1%'],
            ].map(([label, value, Icon, trend]) => (
              <Card key={String(label)} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-muted-foreground text-sm font-medium">
                    {label as string}
                  </CardTitle>
                  <div className="bg-primary/10 rounded-full p-2">
                    {/* @ts-ignore dynamic icon */}
                    <Icon className="text-primary h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{value as React.ReactNode}</p>
                  <p className="mt-1 text-xs font-medium text-emerald-500">
                    {trend as string}{' '}
                    <span className="text-muted-foreground font-normal">from last month</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tier Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tierChartData}
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {tierChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
                  {tierChartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-muted-foreground">
                        {entry.name} ({entry.value})
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Points Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recentActivity.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No activity yet.</p>
                  ) : (
                    data.recentActivity.slice(0, 7).map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold shadow-sm">
                            {item.patronName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-foreground font-medium">{item.patronName}</span>
                            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                              <span>{item.description ?? item.type}</span>
                              <span>·</span>
                              <span>{getRelativeTime(item.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.points >= 0
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }`}
                        >
                          {item.points > 0 ? '+' : ''}
                          {item.points}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {view === 'sales' && salesData && (
        <div className="animate-in fade-in slide-in-from-bottom-2 grid gap-4 duration-500 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Repeat Purchase Rate', `${Math.round(salesData.repeatPurchaseRate * 100)}%`, '+4.2%'],
            ['Redemption Rate', `${Math.round(salesData.redemptionRate * 100)}%`, '+1.8%'],
            ['Avg Visits / Member', salesData.avgVisitsPerMember, '+1.1'],
            ['Lifetime Value', `$${(salesData.totalLifetimeValueCents / 100).toFixed(0)}`, '+$24'],
          ].map(([label, value, trend]) => (
            <Card key={String(label)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{value}</p>
                <p className="mt-1 text-xs font-medium text-emerald-500">
                  {trend} <span className="text-muted-foreground font-normal">from last month</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === 'customer' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 grid gap-6 duration-500 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Churn Risk Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {churnData ? (
                <>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={churnChartData}
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <RechartsTooltip
                          cursor={{ fill: '#f3f4f6' }}
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {churnChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHURN_COLORS[entry.name] || COLORS[0]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="flex h-[280px] items-center justify-center">
                  <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'campaign' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Card>
            <CardHeader>
              <CardTitle>Active Campaigns ({k.activeCampaigns})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignData ? (
                  campaignData.campaigns.slice(0, 10).map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <h4 className="font-medium">{c.name}</h4>
                        <span className="text-muted-foreground text-sm">{c.sentCount} sent</span>
                      </div>
                      <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                        {c.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-center py-8">
                    <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
