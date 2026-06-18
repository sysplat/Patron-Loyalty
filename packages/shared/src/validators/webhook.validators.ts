import { z } from 'zod';

export const createWebhookSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => value.startsWith('https://'), {
      message: 'Webhook URL must use https://',
    }),
  events: z.array(z.string().min(1)).min(1),
});

export const updateWebhookSchema = z
  .object({
    url: z
      .string()
      .url()
      .refine((value) => value.startsWith('https://'), {
        message: 'Webhook URL must use https://',
      })
      .optional(),
    events: z.array(z.string().min(1)).min(1).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict();
