'use client';

import { useDeferredValue, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loyaltyGet, loyaltyPatch, loyaltyPost, fetchPaginated } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Share2,
  UserPlus,
  Gift,
  Users,
  CheckCircle,
  Award,
  Trophy,
  Medal,
  Clock,
  Settings,
} from 'lucide-react';

interface ReferralReport {
  completed: number;
  bonusPointsAwarded: number;
  topReferrers: Array<{
    patronName: string;
    referralCode: string | null;
    completedCount: number;
  }>;
}

interface ReferralRow {
  id: string;
  status: string;
  referrerBonusPoints: number;
  referredBonusPoints: number;
  createdAt: string;
  completedAt: string | null;
  referrerAccount?: {
    referralCode?: string | null;
    customer?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  } | null;
  referredAccount?: {
    customer?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  } | null;
}

interface ProgramBonuses {
  referralBonusPoints: number;
  referredBonusPoints: number;
}

interface CustomerListItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export default function ReferralsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const [applyCode, setApplyCode] = useState('');
  const [patronSearch, setPatronSearch] = useState('');
  const deferredSearch = useDeferredValue(patronSearch.trim());
  const [selectedPatron, setSelectedPatron] = useState<CustomerListItem | null>(null);
  const [advocateBonus, setAdvocateBonus] = useState('');
  const [welcomeBonus, setWelcomeBonus] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['loyalty', 'referrals', 'stats'],
    queryFn: () =>
      loyaltyGet<{
        total: number;
        completed: number;
        pending?: number;
        bonusPointsAwarded: number;
      }>('/loyalty/referrals/stats', token!),
    enabled: !!token,
  });

  const { data: report } = useQuery({
    queryKey: ['loyalty', 'reports', 'referrals'],
    queryFn: () => loyaltyGet<ReferralReport>('/loyalty/reports/referrals', token!),
    enabled: !!token,
  });

  const { data: history } = useQuery({
    queryKey: ['loyalty', 'referrals', 'list'],
    queryFn: () => loyaltyGet<ReferralRow[]>('/loyalty/referrals', token!),
    enabled: !!token,
  });

  const { data: program } = useQuery({
    queryKey: ['loyalty', 'program'],
    queryFn: () => loyaltyGet<ProgramBonuses>('/loyalty/program', token!),
    enabled: !!token,
  });

  const { data: patronResults } = useQuery({
    queryKey: ['customers', 'referral-apply', deferredSearch],
    queryFn: () =>
      fetchPaginated<CustomerListItem>(
        `/customers?search=${encodeURIComponent(deferredSearch)}&limit=8`,
        token!,
      ),
    enabled: !!token && deferredSearch.length >= 2 && !selectedPatron,
  });

  const saveBonuses = useMutation({
    mutationFn: () =>
      loyaltyPatch('/loyalty/program', token!, {
        referralBonusPoints: advocateBonus
          ? Number(advocateBonus)
          : (program?.referralBonusPoints ?? 0),
        referredBonusPoints: welcomeBonus
          ? Number(welcomeBonus)
          : (program?.referredBonusPoints ?? 0),
      }),
    onSuccess: () => {
      toast.success('Referral bonuses updated');
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] });
    },
    onError: () => toast.error('Could not update referral bonuses'),
  });

  const applyReferral = useMutation({
    mutationFn: () =>
      loyaltyPost('/loyalty/referrals/apply', token!, {
        referralCode: applyCode.trim().toUpperCase(),
        customerId: selectedPatron!.id,
      }),
    onSuccess: () => {
      toast.success('Referral applied — bonuses award on first purchase');
      setApplyCode('');
      setSelectedPatron(null);
      setPatronSearch('');
      qc.invalidateQueries({ queryKey: ['loyalty', 'referrals'] });
      qc.invalidateQueries({ queryKey: ['loyalty', 'reports', 'referrals'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Could not apply referral code'),
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Referral Program</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Advocates share invite links. New members join as pending; both bonuses credit after the
            friend&apos;s first purchase.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/program">Edit in Program</Link>
        </Button>
      </div>

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
              Customers share their unique invite links or QR codes from their loyalty portal.
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
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">/refer/[code]</code> and stay
              pending until they buy.
            </CardContent>
          </Card>

          <Card className="bg-muted/30 relative border-2 border-dashed shadow-sm">
            <div className="bg-border absolute -left-3 top-1/2 hidden h-[2px] w-6 -translate-y-1/2 md:block" />
            <CardHeader className="pb-3 text-center">
              <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                <Gift className="text-primary h-6 w-6" />
              </div>
              <CardTitle className="text-base font-medium">3. First purchase</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-center text-sm">
              Counter or POS purchase completes the referral and awards advocate + welcome bonuses.
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="text-primary h-5 w-5" />
              <CardTitle className="text-lg">Bonus settings</CardTitle>
            </div>
            <CardDescription>
              Amounts stored on the program and copied onto each referral when applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Advocate (referrer)</label>
                <Input
                  type="number"
                  min={0}
                  defaultValue={program ? String(program.referralBonusPoints) : ''}
                  key={program ? `adv-${program.referralBonusPoints}` : 'adv'}
                  onChange={(e) => setAdvocateBonus(e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Welcome (referred)</label>
                <Input
                  type="number"
                  min={0}
                  defaultValue={program ? String(program.referredBonusPoints) : ''}
                  key={program ? `wel-${program.referredBonusPoints}` : 'wel'}
                  onChange={(e) => setWelcomeBonus(e.target.value)}
                  placeholder="e.g. 25"
                />
              </div>
            </div>
            <Button
              onClick={() => saveBonuses.mutate()}
              disabled={saveBonuses.isPending || !program}
            >
              Save bonuses
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="text-primary h-5 w-5" />
              <CardTitle className="text-lg">Apply code to patron</CardTitle>
            </div>
            <CardDescription>
              Attach an advocate&apos;s code to an existing customer (pending until first purchase).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Referral code</label>
              <Input
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                placeholder="e.g. ALICE42"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Find patron</label>
              {selectedPatron ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{selectedPatron.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {selectedPatron.email || selectedPatron.phone || selectedPatron.id}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPatron(null);
                      setPatronSearch('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={patronSearch}
                    onChange={(e) => setPatronSearch(e.target.value)}
                    placeholder="Search name, email, or phone"
                  />
                  {deferredSearch.length >= 2 && (patronResults?.data.length ?? 0) > 0 ? (
                    <ul className="max-h-40 overflow-auto rounded-md border text-sm">
                      {patronResults!.data.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="hover:bg-muted w-full px-3 py-2 text-left"
                            onClick={() => {
                              setSelectedPatron(c);
                              setPatronSearch(c.name);
                            }}
                          >
                            <span className="font-medium">{c.name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              {c.email || c.phone || ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
            <Button
              onClick={() => applyReferral.mutate()}
              disabled={applyReferral.isPending || !selectedPatron || applyCode.trim().length < 4}
            >
              Apply referral
            </Button>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Program Impact</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total ?? 0}</div>
              <p className="text-muted-foreground mt-1 text-xs">All statuses</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.pending ?? 0}</div>
              <p className="text-muted-foreground mt-1 text-xs">Awaiting first purchase</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.completed ?? report?.completed ?? 0}</div>
              <p className="text-muted-foreground mt-1 text-xs">Bonuses awarded</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-primary text-sm font-medium">Bonus Points</CardTitle>
              <Award className="text-primary h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-primary text-3xl font-bold">
                {stats?.bonusPointsAwarded ?? report?.bonusPointsAwarded ?? 0}
              </div>
              <p className="text-primary/80 mt-1 text-xs">From completed referrals</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Referral history</CardTitle>
            <CardDescription>Latest 100 referrals (pending and completed).</CardDescription>
          </CardHeader>
          <CardContent>
            {history?.length ? (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">Advocate</th>
                      <th className="px-3 py-2 font-medium">Friend</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Bonuses</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map((row) => {
                      const advocate = row.referrerAccount?.customer;
                      const friend = row.referredAccount?.customer;
                      return (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2.5">
                            {advocate ? (
                              <Link
                                href={`/patrons/${advocate.id}`}
                                className="text-primary font-medium hover:underline"
                              >
                                {advocate.name}
                              </Link>
                            ) : (
                              '—'
                            )}
                            <p className="text-muted-foreground font-mono text-[11px]">
                              {row.referrerAccount?.referralCode ?? ''}
                            </p>
                          </td>
                          <td className="px-3 py-2.5">
                            {friend ? (
                              <Link
                                href={`/patrons/${friend.id}`}
                                className="font-medium hover:underline"
                              >
                                {friend.name}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              variant={row.status === 'completed' ? 'default' : 'secondary'}
                              className="capitalize"
                            >
                              {row.status}
                            </Badge>
                          </td>
                          <td className="text-muted-foreground px-3 py-2.5 text-xs">
                            +{row.referrerBonusPoints} / +{row.referredBonusPoints}
                          </td>
                          <td className="text-muted-foreground whitespace-nowrap px-3 py-2.5 text-xs">
                            {new Date(row.completedAt ?? row.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="text-muted-foreground/50 mb-3 h-8 w-8" />
                <h3 className="text-sm font-medium">No referrals yet</h3>
                <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                  Apply a code above or wait for patrons to join via invite links.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Top Referrers Leaderboard</CardTitle>
            </div>
            <CardDescription>Completed referrals only.</CardDescription>
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
                  Friends must complete a first purchase before advocates appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
