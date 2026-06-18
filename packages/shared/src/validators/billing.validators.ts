import { z } from 'zod';

export const changePlanSchema = z.object({
  planId: z.string().uuid(),
});

export const smsCreditCheckoutSchema = z.object({
  packSlug: z.string().min(1).max(50),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const subscriptionCheckoutSchema = z.object({
  planId: z.string().uuid(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  billingInterval: z.enum(['monthly', 'yearly']).optional(),
});

export const billingPortalSchema = z.object({
  returnUrl: z.string().url(),
});

export const loyaltyAddonCheckoutSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  billingInterval: z.enum(['monthly', 'yearly']).optional(),
});
