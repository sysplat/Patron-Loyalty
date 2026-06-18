import { z } from 'zod';
import { dateTimeString } from './datetime';
import { normalizeSmsRecipient } from '../utils/phone';

const optionalPhone = z
  .string()
  .transform((val, ctx) => {
    if (!val || val.trim() === '') return undefined;
    const normalized = normalizeSmsRecipient(val);
    if (normalized === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid phone number — use international format e.g. +15550001234',
      });
      return z.NEVER;
    }
    return normalized;
  })
  .optional();

export const bookAppointmentBaseSchema = z.object({
  branchId: z.string().uuid(),
  serviceId: z.string().uuid(),
  subServiceId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email().optional(),
  customerPhone: optionalPhone,
  scheduledAt: dateTimeString,
  notes: z.string().max(500).optional(),
  transactionalSmsAllowed: z.boolean().optional(),
  marketingSmsConsent: z.boolean().optional(),
  marketingEmailConsent: z.boolean().optional(),
});

export const bookAppointmentSchema = bookAppointmentBaseSchema.superRefine((data, ctx) => {
  if (data.transactionalSmsAllowed && !data.customerPhone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phone number is required when SMS notifications are enabled',
      path: ['customerPhone'],
    });
  }
});

export const updateAppointmentSchema = z.object({
  status: z.string().max(50).optional(),
  assignedUserId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});
