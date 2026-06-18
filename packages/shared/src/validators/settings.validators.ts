import { z } from 'zod';

export const setSettingSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.unknown(),
});

export const setBulkSettingsSchema = z
  .record(z.string().min(1).max(200), z.unknown())
  .refine((settings) => Object.keys(settings).length > 0, {
    message: 'At least one setting is required',
  });

export const createIntegrationSchema = z.object({
  type: z.string().min(1).max(50),
  config: z.record(z.string(), z.unknown()),
});

export const updateIntegrationSchema = z
  .object({
    config: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict();

export const createSettingsWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().min(1).max(200),
});
