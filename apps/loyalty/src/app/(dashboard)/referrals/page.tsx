'use client';

import { useQuery } from '@tanstack/react-query';
import { loyaltyGet } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  const { data: referrals = [] } = useQuery({
    queryKey: ['loyalty', 'referrals'],
    queryFn: () => loyaltyGet<Array<{ id: string }>>('/loyalty/referrals', token!),
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Referral program</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Total referrals', stats?.total ?? 0],
          ['Completed', stats?.completed ?? 0],
          ['Bonus points awarded', stats?.bonusPointsAwarded ?? 0],
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
      <p className="text-muted-foreground text-sm">{referrals.length} referral records</p>
    </div>
  );
}
