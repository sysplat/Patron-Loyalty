import { z } from 'zod';

export const createReviewSchema = z.object({
  orgId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(100).trim(),
  customerEmail: z.string().email().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  /** Public track context — server resolves contact so email reaches loyalty after approval. */
  ticketId: z.string().uuid().optional(),
  visitId: z.string().uuid().optional(),
});

export const moderateReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
});
