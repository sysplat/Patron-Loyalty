import { z } from 'zod';
import { journeyModeSchema } from './common.validators';

const createServiceFieldsSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(100).trim(),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(1, 'Service duration is required').max(480),
  categoryId: z.string().uuid().optional(),
  branchIds: z.array(z.string().uuid()).optional(),
  queueEnabled: z.boolean().optional(),
  appointmentEnabled: z.boolean().optional(),
  appointmentSlotInterval: z.number().int().min(1).optional(),
  appointmentLeadTimeMinutes: z.number().int().min(0).optional(),
  appointmentMaxAdvanceDays: z.number().int().min(1).optional(),
  appointmentBufferMinutes: z.number().int().min(0).optional(),
  appointmentRequiresEmail: z.boolean().optional(),
  serviceEstimateLowMinutes: z.number().int().min(1, 'Minimum timing is required'),
  serviceEstimateHighMinutes: z.number().int().min(1, 'Maximum timing is required'),
  journeyModeOverride: journeyModeSchema.nullable().optional(),
  instructionalTip: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
});

export { createServiceFieldsSchema };

export const createServiceSchema = createServiceFieldsSchema.refine(
  (value) => value.serviceEstimateLowMinutes <= value.serviceEstimateHighMinutes,
  {
    message: 'Minimum estimate cannot exceed maximum estimate',
    path: ['serviceEstimateHighMinutes'],
  },
);

export const updateServiceSchema = createServiceFieldsSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createServiceCategorySchema = z.object({
  name: z.string().min(1).max(50).trim(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const branchQueueSettingsSchema = z.object({
  serviceEstimateLowMinutes: z.number().int().min(0).optional(),
  serviceEstimateHighMinutes: z.number().int().min(0).optional(),
  journeyModeOverride: journeyModeSchema.nullable().optional(),
});

export const createSubServiceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(1).max(480).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateSubServiceSchema = createSubServiceSchema.partial();

export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;
