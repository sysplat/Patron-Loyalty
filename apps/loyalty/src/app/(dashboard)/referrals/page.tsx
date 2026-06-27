'use client';

import { useQuery } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="space-y-6">
      <div>
        <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Referral program</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Patrons share invite links and QR codes from their portal. New members join at{' '}
          <code className="text-xs">/refer/[code]</code> (SRS §9).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Total referrals', stats?.total ?? 0],
          ['Completed', stats?.completed ?? report?.completed ?? 0],
          ['Bonus points awarded', stats?.bonusPointsAwarded ?? report?.bonusPointsAwarded ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top referrers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {report?.topReferrers.length ? (
            report.topReferrers.map((row) => (
              <div
                key={row.referralCode ?? row.patronName}
                className="flex justify-between text-sm"
              >
                <span>{row.patronName}</span>
                <span className="text-muted-foreground">
                  {row.completedCount} completed · {row.referralCode ?? '—'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No completed referrals yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
