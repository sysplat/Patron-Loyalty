import { z } from 'zod';

export const createSupportRequestSchema = z.object({
  subject: z.string().min(1).max(200).trim(),
  message: z.string().min(1).max(10000),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  category: z.string().max(50).optional(),
});

export const supportMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  /** Platform-operator internal note (platform admin API only). */
  isInternal: z.boolean().optional(),
  /** Org-only note; not sent to QlessQ support. */
  isOrgInternal: z.boolean().optional(),
});

export const reassignSupportContactSchema = z.object({
  contactUserId: z.string().uuid(),
});

export const updateSupportRequestSchema = z.object({
  status: z.string().max(50).optional(),
  priority: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
});
