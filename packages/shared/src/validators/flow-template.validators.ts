import { z } from 'zod';
import {
  callingPolicySchema,
  deskNumberSchema,
  stepRoleSchema,
  uuidSchema,
} from './common.validators';

const flowStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  deskNumber: deskNumberSchema,
  serviceId: uuidSchema,
  queueId: uuidSchema,
  stepRole: stepRoleSchema,
  callingPolicy: callingPolicySchema,
});

export const createFlowTemplateSchema = z
  .object({
    branchId: uuidSchema,
    name: z.string().min(1).max(100).trim(),
    steps: z.array(flowStepSchema).min(2, 'Multi-step templates require at least two steps'),
  })
  .superRefine((value, ctx) => {
    const queueIds = value.steps.map((step) => step.queueId);
    const uniqueQueueIds = new Set(queueIds);
    if (uniqueQueueIds.size !== queueIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each step must use a different queue',
        path: ['steps'],
      });
    }

    const sorted = [...value.steps].sort((a, b) => a.stepIndex - b.stepIndex);
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i]?.stepIndex !== i + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Step indices must be sequential starting at 1',
          path: ['steps'],
        });
        break;
      }
    }

    const deskNumbers = value.steps.map((step) => step.deskNumber);
    if (new Set(deskNumbers).size !== deskNumbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each step must use a different serving desk',
        path: ['steps'],
      });
    }
  });

export const updateFlowTemplateSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    steps: z
      .array(flowStepSchema)
      .min(2, 'Multi-step templates require at least two steps')
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.steps) return;
    const queueIds = value.steps.map((step) => step.queueId);
    if (new Set(queueIds).size !== queueIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each step must use a different queue',
        path: ['steps'],
      });
    }
  });
