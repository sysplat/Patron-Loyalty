import { z } from 'zod';
import { CUSTOMER_SEGMENT_PRESET_VALUES } from '../constants/customer-crm';
import { normalizeSmsRecipient } from '../utils/phone';
import { paginationQuerySchema } from './query.validators';
import { optionalUuidQuery, optionalSearchQuery } from './query.validators';

export const listCustomersQuerySchema = paginationQuerySchema.extend({
  branchId: optionalUuidQuery,
  search: optionalSearchQuery,
  segment: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.enum(CUSTOMER_SEGMENT_PRESET_VALUES as [string, ...string[]]).optional(),
  ),
  savedSegmentId: optionalUuidQuery,
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const createCustomerSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    email: z.string().email().toLowerCase().trim().optional().or(z.literal('')),
    phone: z
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
      .optional(),
    marketingSmsConsent: z.boolean().optional(),
    marketingEmailConsent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least an email or phone number',
        path: ['email'],
      });
    }
  });

export const createCustomerSegmentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  filters: z.object({
    preset: z.enum(CUSTOMER_SEGMENT_PRESET_VALUES as [string, ...string[]]).optional(),
    branchId: z.string().uuid().optional(),
    search: z.string().trim().min(1).max(200).optional(),
  }),
});
