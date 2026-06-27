import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CUSTOMER_SEGMENT_PRESETS, type CustomerSegmentPreset } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomerSegmentService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePresetCustomerIds(
    orgId: string,
    preset: CustomerSegmentPreset,
  ): Promise<string[] | null> {
    if (
      preset === CUSTOMER_SEGMENT_PRESETS.MARKETING_SMS_OPTED_IN ||
      preset === CUSTOMER_SEGMENT_PRESETS.LOYALTY_VIP ||
      preset === CUSTOMER_SEGMENT_PRESETS.LOYALTY_HIGH_LTV ||
      preset === CUSTOMER_SEGMENT_PRESETS.LOYALTY_RFM_CHAMPIONS ||
      preset === CUSTOMER_SEGMENT_PRESETS.LOYALTY_AT_RISK
    ) {
      return null;
    }

    return this.prisma.withTenant(orgId, async (tx) => {
      switch (preset) {
        case CUSTOMER_SEGMENT_PRESETS.REPEAT_VISITORS_90D:
          return this.repeatVisitors90d(tx, orgId);
        case CUSTOMER_SEGMENT_PRESETS.APPOINTMENT_NO_SHOW_LAST:
          return this.appointmentNoShowLast(tx, orgId);
        case CUSTOMER_SEGMENT_PRESETS.LOW_RATING_REVIEW:
          return this.lowRatingReview(tx, orgId);
        case CUSTOMER_SEGMENT_PRESETS.LOYALTY_INACTIVE_90D:
          return this.loyaltyInactive90d(tx, orgId);
        default: {
          const _exhaustive: never = preset;
          return _exhaustive;
        }
      }
    });
  }

  presetWhere(preset: CustomerSegmentPreset): Prisma.CustomerWhereInput | null {
    if (preset === CUSTOMER_SEGMENT_PRESETS.MARKETING_SMS_OPTED_IN) {
      return { marketingSmsConsent: 'GRANTED' };
    }
    if (preset === CUSTOMER_SEGMENT_PRESETS.LOYALTY_VIP) {
      return {
        loyaltyAccount: {
          OR: [
            { tier: { slug: { in: ['gold', 'platinum', 'diamond'] } } },
            { lifetimePointsEarned: { gte: 5000 } },
          ],
        },
      };
    }
    if (preset === CUSTOMER_SEGMENT_PRESETS.LOYALTY_HIGH_LTV) {
      return { loyaltyAccount: { lifetimeValueCents: { gte: 100_000 } } };
    }
    if (preset === CUSTOMER_SEGMENT_PRESETS.LOYALTY_RFM_CHAMPIONS) {
      return {
        loyaltyAccount: {
          healthScore: { gte: 70 },
          totalVisits: { gte: 5 },
          lifetimeValueCents: { gte: 50_000 },
        },
      };
    }
    if (preset === CUSTOMER_SEGMENT_PRESETS.LOYALTY_AT_RISK) {
      return { loyaltyAccount: { churnRisk: { in: ['high', 'medium'] } } };
    }
    return null;
  }

  private async repeatVisitors90d(tx: Prisma.TransactionClient, orgId: string): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT c.id
      FROM customers c
      WHERE c.org_id = ${orgId}::uuid
        AND (
          (
            SELECT COUNT(*)::int
            FROM tickets t
            WHERE t.org_id = c.org_id
              AND t.status IN ('completed', 'served')
              AND COALESCE(t.completed_at, t.booked_at) >= NOW() - INTERVAL '90 days'
              AND (
                t.customer_id = c.id
                OR (c.phone IS NOT NULL AND t.customer_phone = c.phone)
                OR (c.email IS NOT NULL AND lower(t.customer_email) = lower(c.email))
              )
          )
          +
          (
            SELECT COUNT(*)::int
            FROM visits v
            WHERE v.org_id = c.org_id
              AND v.started_at >= NOW() - INTERVAL '90 days'
              AND (
                (c.phone IS NOT NULL AND v.customer_phone = c.phone)
                OR (c.email IS NOT NULL AND lower(v.customer_email) = lower(c.email))
              )
          )
        ) >= 3
    `);
    return rows.map((r) => r.id);
  }

  private async appointmentNoShowLast(
    tx: Prisma.TransactionClient,
    orgId: string,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT c.id
      FROM customers c
      WHERE c.org_id = ${orgId}::uuid
        AND EXISTS (
          SELECT 1
          FROM appointments a
          WHERE a.org_id = c.org_id
            AND a.status = 'no_show'
            AND (
              (c.phone IS NOT NULL AND a.customer_phone = c.phone)
              OR (c.email IS NOT NULL AND lower(a.customer_email) = lower(c.email))
            )
            AND a.scheduled_at = (
              SELECT MAX(a2.scheduled_at)
              FROM appointments a2
              WHERE a2.org_id = c.org_id
                AND (
                  (c.phone IS NOT NULL AND a2.customer_phone = c.phone)
                  OR (c.email IS NOT NULL AND lower(a2.customer_email) = lower(c.email))
                )
            )
        )
    `);
    return rows.map((r) => r.id);
  }

  private async lowRatingReview(tx: Prisma.TransactionClient, orgId: string): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT DISTINCT c.id
      FROM customers c
      INNER JOIN reviews r ON r.org_id = c.org_id
      WHERE c.org_id = ${orgId}::uuid
        AND r.rating <= 3
        AND (
          (c.email IS NOT NULL AND r.customer_email IS NOT NULL AND lower(r.customer_email) = lower(c.email))
          OR lower(r.customer_name) = lower(c.name)
        )
    `);
    return rows.map((r) => r.id);
  }

  private async loyaltyInactive90d(tx: Prisma.TransactionClient, orgId: string): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ customer_id: string }>>(Prisma.sql`
      SELECT la.customer_id
      FROM loyalty_accounts la
      WHERE la.org_id = ${orgId}::uuid
        AND NOT EXISTS (
          SELECT 1
          FROM loyalty_point_ledger lpl
          WHERE lpl.account_id = la.id
            AND lpl.created_at >= NOW() - INTERVAL '90 days'
        )
    `);
    return rows.map((r) => r.customer_id);
  }
}
