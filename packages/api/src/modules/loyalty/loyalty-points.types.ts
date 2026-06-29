import { LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import type { PrismaService } from '../../prisma/prisma.service';

export type LoyaltyApplyPointsResult = {
  account: {
    id: string;
    orgId: string;
    customerId: string;
    pointsBalance: number;
    lifetimePointsEarned: number;
    lifetimePointsBurned: number;
    totalVisits: number;
    tierId: string | null;
    tier: { id: string; slug: string; name: string } | null;
    customer: { id: string; name: string | null };
  };
  idempotent: boolean;
};

export function isEarnSourceIdempotentType(type: string): boolean {
  return type === LOYALTY_POINT_LEDGER_TYPES.EARN || type === LOYALTY_POINT_LEDGER_TYPES.BONUS;
}

export type LoyaltyPointsTx = Parameters<Parameters<PrismaService['withTenant']>[1]>[0];

export type ApplyPointsTxResult = {
  finalAccount: LoyaltyApplyPointsResult['account'];
  type: string;
  points: number;
  delta: number;
  customerId: string;
  idempotent: boolean;
  tierUpgradeSlug?: string | null;
};
