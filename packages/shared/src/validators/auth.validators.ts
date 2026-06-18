import { z } from 'zod';
import { PRODUCT_SKU_VALUES } from '../constants/product';
import { normalizeSmsRecipient } from '../utils/phone';

/**
 * Zod validators for authentication endpoints.
 *
 * Used in both the NestJS API (via ZodValidationPipe or manual parse) and
 * the Next.js web app (client-side form validation). Keep schemas in sync with
 * the auth controller DTOs to avoid divergent validation rules.
 *
 * Password policy: min 8 chars, at least one lower, upper, and digit.
 * Phone: optional — normalized to E.164 via normalizeSmsRecipient before storage.
 *   Accepts common formats (+1 555 000 0000, 10-digit US, 00-prefixed international).
 *   Rejects ambiguous or non-normalizable strings with a clear validation error.
 */

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one lowercase letter, one uppercase letter, and one digit',
  );

export const registerSchema = z
  .object({
    businessName: z
      .string()
      .max(100, 'Business name must be at most 100 characters')
      .trim()
      .optional(),
    organizationName: z
      .string()
      .max(100, 'Organization name must be at most 100 characters')
      .trim()
      .optional(),
    firstName: z.string().max(100).trim().optional(),
    lastName: z.string().max(100).trim().optional(),
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: passwordSchema,
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
    acceptLegal: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy' }),
    }),
    /** `loyalty` = standalone LMS; `qms` (default) = queue; `bundle` = both. */
    productSku: z.enum(PRODUCT_SKU_VALUES).optional(),
  })
  .superRefine((value, ctx) => {
    const name = (value.organizationName ?? value.businessName ?? '').trim();
    if (name.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Business name must be at least 2 characters',
        path: ['organizationName'],
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
  orgId: z.string().optional(),
  platformAdmin: z.boolean().optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const twoFactorLoginSchema = z.object({
  twoFactorToken: z.string().min(1, 'Token required'),
  code: z.string().min(1, 'Code required'),
});

export const enableTwoFactorSchema = z.object({
  code: z.string().min(1, 'Code required'),
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password required'),
  code: z.string().min(1, 'Code required'),
});

export const regenerateBackupCodesSchema = z.object({
  password: z.string().min(1, 'Password required'),
  code: z.string().min(1, 'Code required'),
});

// Types are exported from api.types.ts
