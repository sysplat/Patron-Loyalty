import { z } from 'zod';
import { normalizeSmsRecipient } from '../utils/phone';
import { journeyModeSchema } from './common.validators';

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

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100).trim(),
  address: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  phone: optionalPhone,
  email: z.string().email('Invalid email').optional(),
  defaultJourneyMode: journeyModeSchema.optional(),
  initialDesksCount: z.number().int().min(0).max(100).optional(),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  status: z.enum(['active', 'inactive', 'temporarily_closed']).optional(),
  exceptionalCustomerNotice: z.boolean().optional(),
  exceptionalCustomerNoticeMinutes: z.number().int().min(0).nullable().optional(),
  defaultJourneyMode: journeyModeSchema.optional(),
});

/** Serve-page notice buffer — staff may update via queue:update (not full branch:update). */
export const updateBranchCustomerNoticeSchema = z
  .object({
    /** Optional branch context for branch-scoped RBAC (ignored when persisting). */
    branchId: z.string().uuid().optional(),
    exceptionalCustomerNotice: z.boolean().optional(),
    exceptionalCustomerNoticeMinutes: z.number().int().min(0).nullable().optional(),
  })
  .refine(
    (body) =>
      body.exceptionalCustomerNotice !== undefined ||
      body.exceptionalCustomerNoticeMinutes !== undefined,
    { message: 'At least one notice field is required' },
  );

const workingHourEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM'),
  isClosed: z.boolean(),
  breakStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM')
    .optional(),
  breakEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM')
    .optional(),
});

export const setWorkingHoursSchema = z.object({
  hours: z.array(workingHourEntrySchema),
});

export const upsertDateOverrideSchema = z.object({
  date: z.string().min(1),
  openTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  closeTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  isClosed: z.boolean(),
  breakStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  breakEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  note: z.string().max(255).optional(),
});
