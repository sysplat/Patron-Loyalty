import { z } from 'zod';
import { LOYALTY_EARN_EVENT_TYPES } from '../constants/loyalty';

const customerRefinement = (
  data: {
    customerId?: string;
    email?: string | null;
    phone?: string | null;
    externalId?: string;
  },
  ctx: z.RefinementCtx,
) => {
  if (!data.customerId && !data.email && !data.phone && !data.externalId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide customerId, email, phone, or externalId',
    });
  }
};

export const loyaltyIntegrationUpsertCustomerSchema = z.object({
  externalId: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
});

export const loyaltyIntegrationEarnSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).optional(),
    externalId: z.string().max(100).optional(),
    points: z.number().int().min(1).max(1_000_000).optional(),
    purchaseAmountCents: z.number().int().min(1).max(100_000_000).optional(),
    eventType: z
      .enum([LOYALTY_EARN_EVENT_TYPES.PURCHASE, LOYALTY_EARN_EVENT_TYPES.MANUAL])
      .default(LOYALTY_EARN_EVENT_TYPES.PURCHASE),
    externalTxnId: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  })
  .superRefine(customerRefinement)
  .superRefine((data, ctx) => {
    if (!data.points && !data.purchaseAmountCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide points or purchaseAmountCents',
        path: ['points'],
      });
    }
  });

export const loyaltyIntegrationRedeemSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).optional(),
    externalId: z.string().max(100).optional(),
    rewardId: z.string().uuid(),
    externalTxnId: z.string().min(1).max(100).optional(),
  })
  .superRefine(customerRefinement);

export const loyaltyIntegrationValidateCouponSchema = z.object({
  code: z.string().min(2).max(50),
  accountId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

export const loyaltyIntegrationCouponRedeemSchema = z
  .object({
    code: z.string().min(2).max(50),
    customerId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).optional(),
    externalId: z.string().max(100).optional(),
  })
  .superRefine(customerRefinement);

export const loyaltyIntegrationWalletAdjustSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).optional(),
    externalId: z.string().max(100).optional(),
    type: z.enum(['CREDIT', 'DEBIT', 'REFUND', 'CASHBACK', 'BONUS', 'GIFT']),
    amountCents: z.number().int().min(1).max(10_000_000),
    description: z.string().max(500).optional(),
  })
  .superRefine(customerRefinement);

export const loyaltyPortalRedeemSchema = z.object({
  rewardId: z.string().uuid(),
});

export const loyaltyPortalProfileSchema = z.object({
  birthday: z.string().date().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
});
