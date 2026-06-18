import { z } from 'zod';

const journeyModeSchema = z.enum(['single_ticket', 'visit_multi_step']);
const stepRoleSchema = z.enum(['service', 'pickup']);
const callingPolicySchema = z.enum(['fifo', 'manual_only', 'ready_then_manual', 'ready_then_fifo']);

export const createQueueSchema = z
  .object({
    branchId: z.string().uuid('Invalid branch ID'),
    serviceId: z.string().uuid('Invalid service ID'),
    name: z.string().min(1, 'Queue name is required').max(100).trim(),
    prefix: z
      .string()
      .min(1, 'Prefix is required')
      .max(5, 'Prefix must be at most 5 characters')
      .toUpperCase(),
    maxCapacity: z.number().int().min(1).max(10000).optional(),
    journeyModeOverride: journeyModeSchema.optional(),
    stepRole: stepRoleSchema.nullish(),
    callingPolicy: callingPolicySchema.optional(),
    flowTemplateId: z.string().uuid('Invalid flow template ID').nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.journeyModeOverride === 'visit_multi_step' && !value.stepRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Step role is required for multi-step queues',
        path: ['stepRole'],
      });
    }
    if (value.stepRole === 'pickup' && value.callingPolicy === 'fifo') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pickup queues cannot use fifo calling policy',
        path: ['callingPolicy'],
      });
    }
  });

export const updateQueueSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    prefix: z.string().min(1).max(5).toUpperCase().optional(),
    maxCapacity: z.number().int().min(1).max(10000).nullable().optional(),
    branchId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    journeyModeOverride: journeyModeSchema.nullable().optional(),
    stepRole: stepRoleSchema.nullable().optional(),
    callingPolicy: callingPolicySchema.optional(),
    flowTemplateId: z.string().uuid('Invalid flow template ID').nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.stepRole === 'pickup' && value.callingPolicy === 'fifo') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pickup queues cannot use fifo calling policy',
        path: ['callingPolicy'],
      });
    }
  });

export const stopQueueSchema = z.object({
  forceCloseWaiting: z.boolean().optional(),
  acknowledgeConsequences: z.boolean().optional(),
});

// Types are exported from api.types.ts
