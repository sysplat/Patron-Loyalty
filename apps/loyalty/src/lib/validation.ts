import { z } from 'zod';
import {
  bookAppointmentBaseSchema,
  createAnnouncementSchema,
  createCustomerSchema,
  loginSchema,
  normalizeSmsRecipient,
  registerSchema,
  updateAnnouncementSchema,
} from '@queueplatform/shared';

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Validation failed';
}

export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(input);
  if (!result.success) {
    return { ok: false, error: firstZodError(result.error) };
  }
  return { ok: true, data: result.data };
}

export const publicBookAppointmentSchema = bookAppointmentBaseSchema
  .extend({
    customerEmail: z.string().email('Invalid email address'),
    customerPhone: z
      .string()
      .transform((val, ctx) => {
        if (!val || val.trim() === '') return undefined;
        const normalized = normalizeSmsRecipient(val);
        if (normalized === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Invalid phone — Canada/US 10-digit or international with country code, e.g. +15550001234',
          });
          return z.NEVER;
        }
        return normalized;
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.transactionalSmsAllowed && !data.customerPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone number is required when SMS notifications are enabled',
        path: ['customerPhone'],
      });
    }
  });

export function validateLogin(input: unknown) {
  return parseWithSchema(loginSchema, input);
}

export function validateRegister(input: unknown) {
  return parseWithSchema(registerSchema, input);
}

export function validateCreateCustomer(input: unknown) {
  return parseWithSchema(createCustomerSchema, input);
}

export function validatePublicBookAppointment(input: unknown) {
  return parseWithSchema(publicBookAppointmentSchema, input);
}

export function validateCreateAnnouncement(input: unknown) {
  return parseWithSchema(createAnnouncementSchema, input);
}

export function validateUpdateAnnouncement(input: unknown) {
  return parseWithSchema(updateAnnouncementSchema, input);
}
