'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { loyaltyGet, unwrapApiData } from '@/lib/api-response';
import { useAuthStore } from '@/lib/auth-store';
import {
  buildGettingStartedSteps,
  summarizeGettingStarted,
  type GettingStartedProgressInput,
} from '@/lib/getting-started';

type ProgramSlice = {
  earnRules?: Array<{ eventType: string; active: boolean }>;
};

type DashboardSlice = {
  kpis?: {
    lifetimePointsEarned?: number;
  };
};

type ApiKeyStatus = {
  configured?: boolean;
};

type PosConnection = {
  status?: string;
};

function toProgressInput(args: {
  program?: ProgramSlice;
  rewards?: Array<{ id: string }>;
  dashboard?: DashboardSlice;
  apiKey?: ApiKeyStatus | null;
  pos?: PosConnection[] | null;
}): GettingStartedProgressInput {
  const hasPurchaseRule = (args.program?.earnRules ?? []).some(
    (r) => r.eventType === 'PURCHASE' && r.active,
  );
  const hasReward = (args.rewards ?? []).length > 0;
  const lifetime = args.dashboard?.kpis?.lifetimePointsEarned ?? 0;
  const hasEarnedPoints = lifetime > 0;
  const hasIntegration =
    args.apiKey?.configured === true ||
    (args.pos ?? []).some((c) => String(c.status ?? '').toLowerCase() === 'active');

  return { hasPurchaseRule, hasReward, hasEarnedPoints, hasIntegration };
}

/** Live checklist progress for Getting started (Setup) and related banners. */
export function useGettingStartedProgress(enabled = true) {
  const token = useAuthStore((s) => s.accessToken);
  const active = Boolean(token) && enabled;

  const programQuery = useQuery({
    queryKey: ['loyalty', 'program'],
    queryFn: () => loyaltyGet<ProgramSlice>('/loyalty/program', token!),
    enabled: active,
    staleTime: 30_000,
  });

  const rewardsQuery = useQuery({
    queryKey: ['loyalty', 'rewards'],
    queryFn: () => loyaltyGet<Array<{ id: string }>>('/loyalty/rewards', token!),
    enabled: active,
    staleTime: 30_000,
  });

  const dashboardQuery = useQuery({
    queryKey: ['loyalty', 'dashboard'],
    queryFn: () => loyaltyGet<DashboardSlice>('/loyalty/dashboard', token!),
    enabled: active,
    staleTime: 30_000,
  });

  /** Optional step — may 403 for viewers (needs customer:update). Never toast. */
  const apiKeyQuery = useQuery({
    queryKey: ['loyalty', 'integrations', 'api-key'],
    queryFn: () =>
      api
        .get<unknown>('/loyalty/integrations/api-key', {
          token: token!,
          showErrorToast: false,
        })
        .then((payload) => unwrapApiData<ApiKeyStatus>(payload))
        .catch(() => null),
    enabled: active,
    staleTime: 60_000,
    retry: false,
  });

  const posQuery = useQuery({
    queryKey: ['loyalty', 'integrations', 'pos'],
    queryFn: () =>
      api
        .get<unknown>('/loyalty/integrations/pos', {
          token: token!,
          showErrorToast: false,
        })
        .then((payload) => unwrapApiData<PosConnection[]>(payload) ?? [])
        .catch(() => [] as PosConnection[]),
    enabled: active,
    staleTime: 60_000,
    retry: false,
  });

  const input = toProgressInput({
    program: programQuery.data,
    rewards: rewardsQuery.data,
    dashboard: dashboardQuery.data,
    apiKey: apiKeyQuery.data,
    pos: posQuery.data,
  });

  const steps = buildGettingStartedSteps(input);
  const summary = summarizeGettingStarted(steps);

  const isLoading =
    active && (programQuery.isLoading || rewardsQuery.isLoading || dashboardQuery.isLoading);

  return {
    steps,
    summary,
    input,
    isLoading,
    /** True once required checklist queries have settled (success or error). */
    isReady:
      !active || !(programQuery.isLoading || rewardsQuery.isLoading || dashboardQuery.isLoading),
    isError: programQuery.isError || rewardsQuery.isError || dashboardQuery.isError,
  };
}
