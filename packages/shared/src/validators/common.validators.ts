import { z } from 'zod';

/** Loose JSON object for partial update endpoints that accept arbitrary keys. */
export const jsonRecordSchema = z.record(z.string(), z.unknown());

/** Centrifugo proxy webhook payload (connect / disconnect / etc.). */
export const centrifugoWebhookSchema = z
  .object({
    method: z.string(),
    params: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const uuidSchema = z.string().uuid();

export const deskNumberSchema = z.string().min(1).max(20);

export const ticketSourceSchema = z.enum(['walk_in', 'online', 'kiosk', 'staff', 'public']);

export const callingPolicySchema = z.enum([
  'fifo',
  'manual_only',
  'ready_then_manual',
  'ready_then_fifo',
]);

export const stepRoleSchema = z.enum(['service', 'pickup']);

export const journeyModeSchema = z.enum(['single_ticket', 'visit_multi_step']);
