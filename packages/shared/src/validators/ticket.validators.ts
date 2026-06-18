import { z } from 'zod';
import { normalizeSmsRecipient } from '../utils/phone';
import { deskNumberSchema, ticketSourceSchema, uuidSchema } from './common.validators';

const optionalPhone = z
  .string()
  .transform((val, ctx) => {
    if (!val || val.trim() === '') return undefined;
    const n = normalizeSmsRecipient(val);
    if (n === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid phone number — use international format e.g. +15550001234',
      });
      return z.NEVER;
    }
    return n;
  })
  .optional();

const issueTicketFields = {
  queueId: uuidSchema,
  branchId: uuidSchema,
  serviceId: uuidSchema,
  deskNumber: deskNumberSchema.optional(),
  customerId: uuidSchema.optional(),
  customerName: z.string().max(100).trim().optional(),
  customerPhone: optionalPhone,
  customerEmail: z.string().email('Invalid email').optional(),
  source: ticketSourceSchema.optional(),
  priority: z.number().int().min(0).max(10).optional(),
  language: z.string().max(10).optional(),
  note: z.string().max(500).optional(),
  transactionalSmsAllowed: z.boolean().optional(),
  marketingSmsConsent: z.boolean().optional(),
  marketingEmailConsent: z.boolean().optional(),
};

const ticketSuperRefine = (data: any, ctx: z.RefinementCtx) => {
  if (data.transactionalSmsAllowed && !data.customerPhone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phone number is required when SMS notifications are enabled',
      path: ['customerPhone'],
    });
  }
};

export const issueTicketSchema = z
  .object({
    orgId: uuidSchema.optional(),
    ...issueTicketFields,
  })
  .superRefine(ticketSuperRefine);

export const issueTicketStaffSchema = z.object({
  ...issueTicketFields,
});

export const publicJoinQueueSchema = z
  .object({
    orgId: uuidSchema,
    branchId: uuidSchema,
    queueId: uuidSchema,
    serviceId: uuidSchema,
    customerName: z.string().max(100).trim().optional(),
    customerPhone: optionalPhone,
    language: z.string().max(10).optional(),
    transactionalSmsAllowed: z.boolean().optional(),
    marketingSmsConsent: z.boolean().optional(),
    marketingEmailConsent: z.boolean().optional(),
  })
  .superRefine(ticketSuperRefine);

export const createVisitStepSchema = z
  .object({
    queueId: uuidSchema,
    serviceId: uuidSchema,
    deskNumber: deskNumberSchema.optional(),
    customerName: z.string().max(100).trim().optional(),
    customerPhone: optionalPhone,
    language: z.string().max(10).optional(),
    note: z.string().max(500).optional(),
    source: ticketSourceSchema.optional(),
    priority: z.number().int().min(0).max(10).optional(),
    transactionalSmsAllowed: z.boolean().optional(),
    marketingSmsConsent: z.boolean().optional(),
    marketingEmailConsent: z.boolean().optional(),
  })
  .superRefine(ticketSuperRefine);

export const bookTicketSchema = z.object({
  queueId: uuidSchema,
  customerName: z.string().max(100).trim().optional(),
  customerPhone: optionalPhone,
  customerEmail: z.string().email('Invalid email').optional(),
  source: ticketSourceSchema.optional().default('online'),
  priority: z.number().int().min(0).max(10).optional().default(0),
});

export const callNextTicketSchema = z.object({
  queueId: uuidSchema,
  deskNumber: deskNumberSchema,
  deskFilterActive: z.boolean().optional(),
});

/** Classic single-step: call a specific waiting ticket (manual / ready-then-manual policies). */
export const callWaitingTicketSchema = z.object({
  ticketId: uuidSchema,
  deskNumber: deskNumberSchema,
});

export const ticketIdBodySchema = z.object({
  ticketId: uuidSchema,
});

export const ticketIdsBodySchema = z.object({
  ticketIds: z.array(uuidSchema).min(1),
});

export const anonymizeCustomerSchema = z.object({
  customerId: uuidSchema.optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  dryRun: z.boolean().optional(),
});

export const updateTicketEstimatesSchema = z.object({
  estimatedRemainingMins: z.number().int().min(0).nullable().optional(),
});

export const completeTicketBodySchema = z.object({
  externalRef: z.string().max(100).optional(),
});

export const cancelTicketSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const transferTicketBodySchema = z.object({
  targetQueueId: uuidSchema.optional(),
  targetDeskNumber: deskNumberSchema.optional(),
  externalRef: z.string().max(100).optional(),
});

export const changeDeskTicketSchema = z.object({
  targetDeskNumber: deskNumberSchema,
});

/** @deprecated Legacy shape; prefer callWaitingTicketSchema for agent console row calls. */
export const callTicketSchema = z.object({
  queueId: uuidSchema,
  deskNumber: deskNumberSchema.optional(),
  staffUserId: uuidSchema,
});

export const transferTicketSchema = z.object({
  targetQueueId: uuidSchema,
  targetDeskNumber: deskNumberSchema.optional(),
});

export const updateTicketPreferencesSchema = z.object({
  transactionalSmsAllowed: z.boolean(),
});
