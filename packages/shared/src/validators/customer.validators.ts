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

/** Max data rows accepted by POST /customers/import (excludes header). */
export const CUSTOMER_IMPORT_MAX_ROWS = 2000;

/** Max upload size for patron CSV import (~2MB). */
export const CUSTOMER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export const CUSTOMER_IMPORT_TEMPLATE_HEADERS = [
  'name',
  'email',
  'phone',
  'external_id',
  'tags',
  'notes',
  'birthday',
  'gender',
  'address_line1',
  'city',
  'region',
  'postal_code',
  'country',
  'marketing_sms_consent',
  'marketing_email_consent',
  'opening_points',
] as const;

export type CustomerImportTemplateHeader = (typeof CUSTOMER_IMPORT_TEMPLATE_HEADERS)[number];

export const CUSTOMER_IMPORT_ROW_STATUSES = ['created', 'updated', 'error'] as const;
export type CustomerImportRowStatus = (typeof CUSTOMER_IMPORT_ROW_STATUSES)[number];

/** Parse CSV consent cell → GRANTED, false → REVOKED, blank → undefined (leave unchanged). */
export function parseCustomerImportConsent(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (['1', 'true', 'yes', 'y', 'granted', 'opted_in', 'optedin', 'opt-in'].includes(v)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'revoked', 'opted_out', 'optedout', 'opt-out'].includes(v)) {
    return false;
  }
  return undefined;
}

function emptyToUndefined(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  return v;
}

function parseTagsCell(raw: unknown): string[] | undefined {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const tags = s
    .split(/[;|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
  return tags.length > 0 ? tags : undefined;
}

const optionalPhoneImport = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((val, ctx) => {
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
);

const optionalEmailImport = z.preprocess(
  emptyToUndefined,
  z.string().email().toLowerCase().trim().optional(),
);

export const customerImportRowSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    email: optionalEmailImport,
    phone: optionalPhoneImport,
    externalId: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
    tags: z.preprocess(parseTagsCell, z.array(z.string().trim().min(1).max(50)).max(20).optional()),
    notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
    birthday: z.preprocess(emptyToUndefined, z.string().date().optional()),
    gender: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
    addressLine1: z.preprocess(emptyToUndefined, z.string().trim().max(255).optional()),
    city: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
    region: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
    postalCode: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
    country: z.preprocess(emptyToUndefined, z.string().trim().length(2).toUpperCase().optional()),
    marketingSmsConsent: z.boolean().optional(),
    marketingEmailConsent: z.boolean().optional(),
    openingPoints: z.preprocess((v) => {
      const cleared = emptyToUndefined(v);
      if (cleared === undefined) return undefined;
      if (typeof cleared === 'number') return cleared;
      const n = Number(String(cleared).trim());
      return Number.isFinite(n) ? n : cleared;
    }, z.number().int().min(0).max(10_000_000).optional()),
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

export type CustomerImportRow = z.infer<typeof customerImportRowSchema>;

export type CustomerImportRowResult = {
  row: number;
  status: CustomerImportRowStatus;
  customerId?: string;
  error?: string;
};

export type CustomerImportResult = {
  created: number;
  updated: number;
  errors: number;
  rows: CustomerImportRowResult[];
};
