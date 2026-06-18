import { z } from 'zod';

export const createNotificationTemplateSchema = z.object({
  type: z.string().min(1).max(50),
  channel: z.string().min(1).max(20),
  subject: z.string().max(200).optional(),
  body: z.string().min(1),
  variables: z.array(z.string().max(50)).optional(),
});

export const updateNotificationTemplateSchema = z
  .object({
    subject: z.string().max(200).optional(),
    body: z.string().min(1).optional(),
    variables: z.array(z.string().max(50)).optional(),
  })
  .strict();

export const sendNotificationSchema = z.object({
  channel: z.string().min(1).max(20),
  to: z.string().min(1).max(200),
  templateId: z.string().uuid().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
  messageCategory: z.enum(['transactional', 'marketing']).optional(),
  recipientConsent: z
    .object({
      transactionalSmsAllowed: z.boolean().optional(),
    })
    .optional(),
});

export const testSmsSchema = z.object({
  to: z.string().min(1).max(30),
});

export const twilioStatusWebhookSchema = z.record(z.string(), z.string());

export const SuppressionChannelSchema = z.enum(['SMS', 'EMAIL']);
export const SuppressionSourceSchema = z.enum([
  'WEBHOOK_STOP',
  'ADMIN_PORTAL',
  'DSAR_PURGE',
  'SYSTEM',
]);

export const UniversalSuppressionSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid().nullable().optional(),
  contactHash: z.string().length(64),
  channel: SuppressionChannelSchema,
  source: SuppressionSourceSchema,
  reason: z.string().max(255).nullable().optional(),
  createdAt: z.date(),
});

export const CreateUniversalSuppressionSchema = UniversalSuppressionSchema.omit({
  id: true,
  createdAt: true,
});
