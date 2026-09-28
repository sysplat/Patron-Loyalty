'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { DASHBOARD_PAGE_HEADING_CLASS } from '@queueplatform/frontend-core';
import { useGettingStartedProgress } from '@/hooks/use-getting-started-progress';
import {
  clearGettingStartedDismiss,
  dismissGettingStarted,
  isGettingStartedDismissed,
} from '@/lib/getting-started';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Gift,
  Phone,
  Plug,
  RefreshCw,
  Settings2,
  Sparkles,
} from 'lucide-react';

const GUIDE: { title: string; body: string }[] = [
  {
    title: 'Standalone first',
    body: 'You do not need POS or QPlatform to launch. Counter awards points from your Program purchase rule.',
  },
  {
    title: 'Earn rule',
    body: 'Keep an active PURCHASE rule — typically 1 point per $1. Adjust anytime under Program.',
  },
  {
    title: 'Reward',
    body: 'Members need something to redeem. Start with one simple discount or free item.',
  },
  {
    title: 'Counter test',
    body: 'Look up a phone, record a sale amount, and confirm points land. That proves the loop works.',
  },
];

const STEP_ICONS = {
  earn: Settings2,
  reward: Gift,
  counter: Phone,
  integrations: Plug,
} as const;

export default function GettingStartedPage() {
  const qc = useQueryClient();
  const { steps, summary, isLoading, isReady } = useGettingStartedProgress();
  const [guideOpen, setGuideOpen] = useState(true);
  const [dismissed, setDismissed] = useState(() => isGettingStartedDismissed());
  const [suppressAutoDismiss, setSuppressAutoDismiss] = useState(false);

  // Once required setup is done, stop forcing checklist on next login —
  // unless the owner explicitly restored reminders this session.
  useEffect(() => {
    if (suppressAutoDismiss) return;
    if (!isReady || !summary.requiredComplete || dismissed) return;
    dismissGettingStarted();
    setDismissed(true);
  }, [isReady, summary.requiredComplete, dismissed, suppressAutoDismiss]);

  function onDismiss() {
    setSuppressAutoDismiss(false);
    dismissGettingStarted();
    setDismissed(true);
  }

  function onRestore() {
    setSuppressAutoDismiss(true);
    clearGettingStartedDismiss();
    setDismissed(false);
  }

  async function onRefresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['loyalty', 'program'] }),
      qc.invalidateQueries({ queryKey: ['loyalty', 'rewards'] }),
      qc.invalidateQueries({ queryKey: ['loyalty', 'dashboard'] }),
      qc.invalidateQueries({ queryKey: ['loyalty', 'integrations'] }),
    ]);
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={DASHBOARD_PAGE_HEADING_CLASS}>Getting started</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Finish these steps so every sale can earn and redeem — no POS required.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setGuideOpen((v) => !v)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Guide
            {guideOpen ? (
              <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void onRefresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {dismissed ? (
            <Button type="button" variant="outline" size="sm" onClick={onRestore}>
              Show reminders
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Hide reminders
            </Button>
          )}
        </div>
      </div>

      {guideOpen ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Launch guide</CardTitle>
            <CardDescription>
              Standalone merchants go live with Program → Rewards → Counter. Integrations are
              optional later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-2">
              {GUIDE.map((item) => (
                <li key={item.title} className="space-y-1">
                  <p className="text-foreground font-medium">{item.title}</p>
                  <p className="text-xs leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Required done',
            value: isLoading ? '—' : `${summary.requiredDone}/${summary.requiredTotal}`,
          },
          {
            label: 'Optional',
            value: isLoading ? '—' : `${summary.optionalDone}/${summary.optionalTotal}`,
          },
          {
            label: 'Status',
            value: isLoading
              ? '—'
              : summary.requiredComplete
                ? 'Ready for Counter'
                : 'Setup in progress',
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {summary.requiredComplete ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <div>
                <p className="font-medium text-emerald-950 dark:text-emerald-100">
                  Required setup complete
                </p>
                <p className="text-muted-foreground text-sm">
                  Use Counter for every sale. Connect POS or an API key anytime under Integrations.
                </p>
              </div>
            </div>
            <Button type="button" size="sm" asChild>
              <Link href="/lookup">Open Counter</Link>
            </Button>
          </CardContent>
        </Card>
      ) : summary.next ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Next step
              </p>
              <p className="mt-0.5 font-medium">{summary.next.title}</p>
              <p className="text-muted-foreground text-sm">{summary.next.description}</p>
            </div>
            <Button type="button" size="sm" asChild>
              <Link href={summary.next.href}>{summary.next.cta}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))
          : steps.map((step, index) => {
              const Icon = STEP_ICONS[step.id];
              return (
                <Card
                  key={step.id}
                  className={cn(
                    'transition-colors',
                    step.done && 'border-emerald-500/30 bg-emerald-500/[0.03]',
                  )}
                >
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                          step.done
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {step.done ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{step.title}</p>
                          {step.optional ? (
                            <Badge variant="secondary" className="font-normal">
                              Optional
                            </Badge>
                          ) : null}
                          {step.done ? (
                            <Badge
                              variant="secondary"
                              className="border-transparent bg-emerald-500/10 font-normal text-emerald-800 dark:text-emerald-300"
                            >
                              Done
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                              <Circle className="h-3 w-3" />
                              To do
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={step.done ? 'outline' : 'default'}
                      className="shrink-0"
                      asChild
                    >
                      <Link href={step.href}>
                        <Icon className="mr-2 h-4 w-4" />
                        {step.done ? 'Review' : step.cta}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
