import { z } from 'zod';
import {
  callingPolicySchema,
  deskNumberSchema,
  stepRoleSchema,
  uuidSchema,
} from './common.validators';

const guidedServiceNewSchema = z.object({
  mode: z.literal('new'),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(1).max(480),
  serviceEstimateLowMinutes: z.number().int().min(1),
  serviceEstimateHighMinutes: z.number().int().min(1),
  instructionalTip: z.string().max(500).nullable().optional(),
});

const guidedServiceExistingSchema = z.object({
  mode: z.literal('existing'),
  serviceId: uuidSchema,
});

export const guidedServiceInputSchema = z
  .discriminatedUnion('mode', [guidedServiceNewSchema, guidedServiceExistingSchema])
  .superRefine((value, ctx) => {
    if (value.mode !== 'new') return;
    if (value.serviceEstimateLowMinutes > value.serviceEstimateHighMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum estimate cannot exceed maximum estimate',
        path: ['serviceEstimateHighMinutes'],
      });
    }
  });

const guidedQueueNewSchema = z.object({
  mode: z.literal('new'),
  name: z.string().min(1).max(100).trim(),
  prefix: z.string().min(1).max(5).toUpperCase(),
  callingPolicy: callingPolicySchema,
});

const guidedQueueExistingSchema = z.object({
  mode: z.literal('existing'),
  queueId: uuidSchema,
});

export const guidedSingleQueueInputSchema = z.discriminatedUnion('mode', [
  guidedQueueNewSchema,
  guidedQueueExistingSchema,
]);

const guidedStepQueueNewSchema = z.object({
  mode: z.literal('new'),
  name: z.string().min(1).max(100).trim(),
  prefix: z.string().min(1).max(5).toUpperCase(),
});

const guidedStepQueueExistingSchema = z.object({
  mode: z.literal('existing'),
  queueId: uuidSchema,
});

const guidedMultiStepSchema = z.object({
  deskNumber: deskNumberSchema,
  stepRole: stepRoleSchema,
  callingPolicy: callingPolicySchema,
  queue: z.discriminatedUnion('mode', [guidedStepQueueNewSchema, guidedStepQueueExistingSchema]),
});

export const guidedSetupSingleDeploySchema = z.object({
  flowType: z.literal('single'),
  branchId: uuidSchema,
  service: guidedServiceInputSchema,
  queue: guidedSingleQueueInputSchema,
});

export const guidedSetupMultiDeploySchema = z.object({
  flowType: z.literal('multi'),
  branchId: uuidSchema,
  service: guidedServiceInputSchema,
  templateName: z.string().min(1).max(100).trim(),
  autoActivate: z.boolean().optional().default(true),
  steps: z.array(guidedMultiStepSchema).min(2, 'Multi-step journeys require at least two steps'),
});

export const guidedSetupDeploySchema = z.discriminatedUnion('flowType', [
  guidedSetupSingleDeploySchema,
  guidedSetupMultiDeploySchema,
]);

export type GuidedSetupDeployInput = z.infer<typeof guidedSetupDeploySchema>;

/** Client-side / shared validation for multi-step guided builder drafts. */
export function validateGuidedMultiSteps(
  steps: Array<{
    mode: 'existing' | 'new';
    selectedQueueId?: string;
    newQueuePrefix?: string;
    deskNumber?: string;
    stepRole?: string;
    callingPolicy?: string;
  }>,
  branchQueues: Array<{ prefix?: string | null }> = [],
): string | null {
  if (steps.length < 2) return 'Multi-step journeys require at least two steps';
  if (steps[0]?.stepRole !== 'service') return 'First step must be a service step';

  const queueIds = new Set<string>();
  const newPrefixes = new Set<string>();
  const deskNumbers = new Set<string>();

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step.deskNumber) return `Step ${i + 1}: serving desk is required`;
    const desk = step.deskNumber.trim();
    if (deskNumbers.has(desk)) {
      return `Step ${i + 1}: each step must use a different serving desk`;
    }
    deskNumbers.add(desk);

    if (step.mode === 'existing') {
      if (!step.selectedQueueId) return `Step ${i + 1}: select a queue`;
      if (queueIds.has(step.selectedQueueId)) {
        return `Step ${i + 1}: the same queue cannot appear in multiple steps`;
      }
      queueIds.add(step.selectedQueueId);
    } else {
      const prefix = step.newQueuePrefix?.trim().toUpperCase() ?? '';
      if (!prefix) return `Step ${i + 1}: ticket prefix is required`;
      if (newPrefixes.has(prefix)) {
        return `Step ${i + 1}: ticket prefix "${prefix}" is already used in this journey`;
      }
      const branchPrefixError = validateGuidedSingleQueuePrefix(prefix, branchQueues, [
        ...newPrefixes,
      ]);
      if (branchPrefixError) {
        return `Step ${i + 1}: ${branchPrefixError}`;
      }
      newPrefixes.add(prefix);
    }

    if (step.stepRole === 'pickup' && step.callingPolicy === 'fifo') {
      return `Step ${i + 1}: pickup steps cannot use strict FIFO calling`;
    }
  }

  return null;
}

export function validateGuidedSingleQueuePrefix(
  prefix: string,
  branchQueues: Array<{ prefix?: string | null }>,
  existingPrefixesInDraft: string[] = [],
): string | null {
  const normalized = prefix.trim().toUpperCase();
  if (!normalized) return 'Ticket prefix is required';
  if (existingPrefixesInDraft.includes(normalized)) {
    return `Ticket prefix "${normalized}" is already used in this setup`;
  }
  const clash = branchQueues.find((q) => (q.prefix ?? '').toUpperCase() === normalized);
  if (clash) return `Ticket prefix "${normalized}" is already used in this branch`;
  return null;
}
