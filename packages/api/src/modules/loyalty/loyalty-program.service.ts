import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  LOYALTY_DEFAULT_EARN_RULES,
  LOYALTY_DEFAULT_TIERS,
  LOYALTY_EARN_EVENT_TYPES,
  type LoyaltyEarnEventType,
} from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { generateReferralCode } from './loyalty-referral-code.util';

@Injectable()
export class LoyaltyProgramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  private async requireLoyalty(orgId: string): Promise<void> {
    await this.patronCrmFeature.requireEnabled(orgId);
  }

  async getOrCreateProgram(orgId: string) {
    await this.requireLoyalty(orgId);
    return this.prisma.withTenant(orgId, async (tx) => {
      const existing = await tx.loyaltyProgram.findUnique({
        where: { orgId },
        include: {
          tiers: { orderBy: { sortOrder: 'asc' } },
          earnRules: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (existing) return existing;

      const program = await tx.loyaltyProgram.create({
        data: { orgId },
      });

      await tx.loyaltyTier.createMany({
        data: LOYALTY_DEFAULT_TIERS.map((tier) => ({
          orgId,
          programId: program.id,
          name: tier.name,
          slug: tier.slug,
          minLifetimePoints: tier.minLifetimePoints,
          sortOrder: tier.sortOrder,
          color: tier.color,
        })),
      });

      await tx.loyaltyEarnRule.createMany({
        data: LOYALTY_DEFAULT_EARN_RULES.map((rule) => ({
          orgId,
          programId: program.id,
          name: rule.name,
          eventType: rule.eventType,
          points: rule.points,
        })),
      });

      return tx.loyaltyProgram.findUniqueOrThrow({
        where: { id: program.id },
        include: {
          tiers: { orderBy: { sortOrder: 'asc' } },
          earnRules: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
  }

  async updateProgram(
    orgId: string,
    data: {
      enabled?: boolean;
      pointsCurrencyName?: string;
      defaultEarnPoints?: number;
      referralBonusPoints?: number;
      referredBonusPoints?: number;
      pointsExpiryDays?: number | null;
      displayCurrencyCode?: string;
      defaultLocale?: string;
    },
  ) {
    await this.getOrCreateProgram(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyProgram.update({
        where: { orgId },
        data,
        include: { tiers: { orderBy: { sortOrder: 'asc' } }, earnRules: true },
      }),
    );
  }

  async createTier(
    orgId: string,
    data: {
      name: string;
      slug: string;
      minLifetimePoints: number;
      sortOrder?: number;
      color?: string | null;
      benefits?: Record<string, unknown>;
    },
  ) {
    const program = await this.getOrCreateProgram(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyTier.create({
        data: {
          orgId,
          programId: program.id,
          name: data.name,
          slug: data.slug,
          minLifetimePoints: data.minLifetimePoints,
          sortOrder: data.sortOrder ?? 0,
          color: data.color ?? null,
          benefits: (data.benefits ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      }),
    );
  }

  async createEarnRule(
    orgId: string,
    data: {
      name: string;
      eventType: LoyaltyEarnEventType;
      points: number;
      active?: boolean;
      conditions?: Record<string, unknown>;
    },
  ) {
    const program = await this.getOrCreateProgram(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyEarnRule.create({
        data: {
          orgId,
          programId: program.id,
          name: data.name,
          eventType: data.eventType,
          points: data.points,
          active: data.active ?? true,
          conditions: (data.conditions ?? {}) as Prisma.InputJsonValue,
        },
      }),
    );
  }

  async updateEarnRule(
    orgId: string,
    ruleId: string,
    data: {
      name?: string;
      points?: number;
      active?: boolean;
      conditions?: Record<string, unknown>;
    },
  ) {
    await this.getOrCreateProgram(orgId);
    return this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyEarnRule.update({
        where: { id: ruleId },
        data: {
          name: data.name,
          points: data.points,
          active: data.active,
          ...(data.conditions !== undefined
            ? { conditions: data.conditions as Prisma.InputJsonValue }
            : {}),
        },
      }),
    );
  }

  private ruleMatchesConditions(
    conditions: Record<string, unknown>,
    ctx: {
      purchaseAmountCents?: number;
      branchId?: string;
      tierSlug?: string | null;
      lifetimePointsEarned?: number;
    },
  ): boolean {
    const minPurchase = conditions.minPurchaseCents;
    if (typeof minPurchase === 'number' && (ctx.purchaseAmountCents ?? 0) < minPurchase) {
      return false;
    }
    const branchId = conditions.branchId;
    if (typeof branchId === 'string' && branchId && ctx.branchId !== branchId) {
      return false;
    }
    const tierSlugs = conditions.tierSlugs;
    if (Array.isArray(tierSlugs) && tierSlugs.length > 0) {
      if (!ctx.tierSlug || !tierSlugs.includes(ctx.tierSlug)) return false;
    }
    const minLifetime = conditions.minLifetimePoints;
    if (typeof minLifetime === 'number' && (ctx.lifetimePointsEarned ?? 0) < minLifetime) {
      return false;
    }
    return true;
  }

  async resolveEarnPoints(
    orgId: string,
    eventType: LoyaltyEarnEventType,
    ctx: {
      purchaseAmountCents?: number;
      branchId?: string;
      tierSlug?: string | null;
      lifetimePointsEarned?: number;
    } = {},
  ): Promise<number> {
    const enabled = await this.patronCrmFeature.isEnabled(orgId);
    if (!enabled) return 0;

    const program = await this.prisma.withTenant(orgId, (tx) =>
      tx.loyaltyProgram.findUnique({
        where: { orgId },
        include: {
          earnRules: { where: { eventType, active: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
    );

    if (!program?.enabled) return 0;

    for (const rule of program.earnRules) {
      const conditions = (rule.conditions ?? {}) as Record<string, unknown>;
      if (!this.ruleMatchesConditions(conditions, ctx)) continue;
      if (
        eventType === LOYALTY_EARN_EVENT_TYPES.PURCHASE &&
        rule.points === 1 &&
        (ctx.purchaseAmountCents ?? 0) > 0
      ) {
        return Math.floor((ctx.purchaseAmountCents ?? 0) / 100);
      }
      return rule.points;
    }

    if (eventType === LOYALTY_EARN_EVENT_TYPES.PURCHASE && (ctx.purchaseAmountCents ?? 0) > 0) {
      return Math.floor((ctx.purchaseAmountCents ?? 0) / 100);
    }

    return program.defaultEarnPoints;
  }

  async generateUniqueReferralCode(orgId: string): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateReferralCode();
      const exists = await this.prisma.withTenant(orgId, (tx) =>
        tx.loyaltyAccount.findFirst({ where: { orgId, referralCode: code }, select: { id: true } }),
      );
      if (!exists) return code;
    }
    return generateReferralCode(12);
  }
}
