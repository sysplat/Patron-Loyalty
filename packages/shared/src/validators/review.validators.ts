import { z } from 'zod';

export const createReviewSchema = z.object({
  orgId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(100).trim(),
  customerEmail: z.string().email().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export const moderateReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
});
