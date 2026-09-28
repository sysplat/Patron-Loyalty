/** In-app setup checklist for standalone merchants after signup. */

export const GETTING_STARTED_DISMISS_KEY = 'loyalty-getting-started-dismissed';

export type GettingStartedStepId = 'earn' | 'reward' | 'counter' | 'integrations';

export type GettingStartedStep = {
  id: GettingStartedStepId;
  title: string;
  description: string;
  href: string;
  cta: string;
  optional?: boolean;
  done: boolean;
};

export type GettingStartedProgressInput = {
  hasPurchaseRule: boolean;
  hasReward: boolean;
  /** True when any points have been earned (Counter purchase, POS, etc.). */
  hasEarnedPoints: boolean;
  hasIntegration: boolean;
};

export function isGettingStartedDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(GETTING_STARTED_DISMISS_KEY) === '1';
}

export function dismissGettingStarted(): void {
  window.localStorage.setItem(GETTING_STARTED_DISMISS_KEY, '1');
}

export function clearGettingStartedDismiss(): void {
  window.localStorage.removeItem(GETTING_STARTED_DISMISS_KEY);
}

export function buildGettingStartedSteps(input: GettingStartedProgressInput): GettingStartedStep[] {
  return [
    {
      id: 'earn',
      title: 'Confirm how purchases earn',
      description:
        'Open Program and keep an active PURCHASE rule (1 point per $1 is the usual standalone preset).',
      href: '/program',
      cta: 'Open Program',
      done: input.hasPurchaseRule,
    },
    {
      id: 'reward',
      title: 'Add a redeemable reward',
      description: 'Create at least one reward members can spend points on.',
      href: '/rewards',
      cta: 'Open Rewards',
      done: input.hasReward,
    },
    {
      id: 'counter',
      title: 'Test Counter with a sale',
      description: 'Look up a phone on Counter and record a purchase so points award correctly.',
      href: '/lookup',
      cta: 'Open Counter',
      done: input.hasEarnedPoints,
    },
    {
      id: 'integrations',
      title: 'Optional: connect POS or API',
      description:
        'Square, Clover, QPlatform, or an API key when you want purchases to sync automatically.',
      href: '/integrations',
      cta: 'Open Integrations',
      optional: true,
      done: input.hasIntegration,
    },
  ];
}

export function summarizeGettingStarted(steps: GettingStartedStep[]) {
  const required = steps.filter((s) => !s.optional);
  const requiredDone = required.filter((s) => s.done).length;
  const optional = steps.filter((s) => s.optional);
  const optionalDone = optional.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done && !s.optional) ?? steps.find((s) => !s.done) ?? null;
  return {
    requiredTotal: required.length,
    requiredDone,
    optionalTotal: optional.length,
    optionalDone,
    requiredComplete: requiredDone >= required.length,
    allComplete: steps.every((s) => s.done),
    next,
  };
}
