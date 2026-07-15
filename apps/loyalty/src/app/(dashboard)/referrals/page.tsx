'use client';

import { useQuery } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Share2, UserPlus, Gift, Users, CheckCircle, Award, Trophy, Medal } from 'lucide-react';

interface ReferralReport {
  completed: number;
  bonusPointsAwarded: number;
  topReferrers: Array<{
    patronName: string;
    referralCode: string | null;
    completedCount: number;
  }>;
}

export default function ReferralsPage() {
  const token = useAuthStore((s) => s.accessToken);

  const { data: stats } = useQuery({
    queryKey: ['loyalty', 'referrals', 'stats'],
    queryFn: () =>
      loyaltyGet<{
        total: number;
        completed: number;
        bonusPointsAwarded: number;
      }>('/loyalty/referrals/stats', token!),
    enabled: !!token,
  });

  const { data: report } = useQuery({
    queryKey: ['loyalty', 'reports', 'referrals'],
    queryFn: () => loyaltyGet<ReferralReport>('/loyalty/reports/referrals', token!),
    enabled: !!token,
  });

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Referral Program</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Turn your best customers into your biggest advocates. When a patron shares their invite
            link, new members can join instantly to earn rewards.
          </p>
        </div>
      </div>

      {/* How it Works - Visual Explainer */}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">How it works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-muted/30 border-2 border-dashed shadow-sm">
            <CardHeader className="pb-3 text-center">
              <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                <Share2 className="text-primary h-6 w-6" />
              </div>
              <CardTitle className="text-base font-medium">1. Share</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-center text-sm">
              Patrons share their unique invite links or QR codes directly from their loyalty
              portal.
            </CardContent>
          </Card>

          <Card className="bg-muted/30 relative border-2 border-dashed shadow-sm">
            <div className="bg-border absolute -left-3 top-1/2 hidden h-[2px] w-6 -translate-y-1/2 md:block" />
            <CardHeader className="pb-3 text-center">
              <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                <UserPlus className="text-primary h-6 w-6" />
              </div>
              <CardTitle className="text-base font-medium">2. Join</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-center text-sm">
              New members join via{' '}
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">/refer/[code]</code> and are
              instantly credited.
            </CardContent>
          </Card>

          <Card className="bg-muted/30 relative border-2 border-dashed shadow-sm">
            <div className="bg-border absolute -left-3 top-1/2 hidden h-[2px] w-6 -translate-y-1/2 md:block" />
            <CardHeader className="pb-3 text-center">
              <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                <Gift className="text-primary h-6 w-6" />
              </div>
              <CardTitle className="text-base font-medium">3. Earn</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-center text-sm">
              Both the referring patron and the new member earn automated bonus points.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Program Statistics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Program Impact</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total ?? 0}</div>
              <p className="text-muted-foreground mt-1 text-xs">Invites generated</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.completed ?? report?.completed ?? 0}</div>
              <p className="text-muted-foreground mt-1 text-xs">Successfully joined</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-primary text-sm font-medium">
                Bonus Points Awarded
              </CardTitle>
              <Award className="text-primary h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-primary text-3xl font-bold">
                {stats?.bonusPointsAwarded ?? report?.bonusPointsAwarded ?? 0}
              </div>
              <p className="text-primary/80 mt-1 text-xs">Distributed to advocates</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Top Referrers Leaderboard</CardTitle>
            </div>
            <CardDescription>Your most valuable patrons generating new business.</CardDescription>
          </CardHeader>
          <CardContent>
            {report?.topReferrers.length ? (
              <div className="divide-y rounded-md border">
                {report.topReferrers.map((row, index) => (
                  <div
                    key={row.referralCode ?? row.patronName}
                    className="hover:bg-muted/50 flex items-center justify-between p-4 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                        {index === 0 ? <Medal className="h-4 w-4 text-yellow-500" /> : index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{row.patronName}</p>
                        <p className="text-muted-foreground mt-0.5 font-mono text-xs uppercase">
                          Code: {row.referralCode ?? '—'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{row.completedCount}</p>
                      <p className="text-muted-foreground text-xs">completed</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <Users className="text-muted-foreground/50 h-6 w-6" />
                </div>
                <h3 className="text-sm font-medium">No completed referrals yet</h3>
                <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                  Once your patrons start sharing their links and friends join, the top advocates
                  will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
