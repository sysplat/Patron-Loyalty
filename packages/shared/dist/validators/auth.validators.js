"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateBackupCodesSchema = exports.disableTwoFactorSchema = exports.enableTwoFactorSchema = exports.twoFactorLoginSchema = exports.refreshTokenSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.verifyEmailSchema = exports.loginSchema = exports.registerSchema = exports.passwordSchema = void 0;
const zod_1 = require("zod");
const product_1 = require("../constants/product");
const phone_1 = require("../utils/phone");
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
exports.passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one digit');
exports.registerSchema = zod_1.z
    .object({
    businessName: zod_1.z
        .string()
        .max(100, 'Business name must be at most 100 characters')
        .trim()
        .optional(),
    organizationName: zod_1.z
        .string()
        .max(100, 'Organization name must be at most 100 characters')
        .trim()
        .optional(),
    firstName: zod_1.z.string().max(100).trim().optional(),
    lastName: zod_1.z.string().max(100).trim().optional(),
    email: zod_1.z.string().email('Invalid email address').toLowerCase().trim(),
    password: exports.passwordSchema,
    phone: zod_1.z
        .string()
        .transform((val, ctx) => {
        if (!val || val.trim() === '')
            return undefined;
        const n = (0, phone_1.normalizeSmsRecipient)(val);
        if (n === null) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Invalid phone number — use international format e.g. +15550001234',
            });
            return zod_1.z.NEVER;
        }
        return n;
    })
        .optional(),
    acceptLegal: zod_1.z.literal(true, {
        errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy' }),
    }),
    /** `loyalty` = standalone LMS; `qms` (default) = queue; `bundle` = both. */
    productSku: zod_1.z.enum(product_1.PRODUCT_SKU_VALUES).optional(),
})
    .superRefine((value, ctx) => {
    const name = (value.organizationName ?? value.businessName ?? '').trim();
    if (name.length < 2) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Business name must be at least 2 characters',
            path: ['organizationName'],
        });
    }
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').toLowerCase().trim(),
    password: zod_1.z.string().min(1, 'Password is required'),
    orgId: zod_1.z.string().optional(),
    platformAdmin: zod_1.z.boolean().optional(),
});
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Verification token is required'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').toLowerCase().trim(),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    password: exports.passwordSchema,
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
exports.twoFactorLoginSchema = zod_1.z.object({
    twoFactorToken: zod_1.z.string().min(1, 'Token required'),
    code: zod_1.z.string().min(1, 'Code required'),
});
exports.enableTwoFactorSchema = zod_1.z.object({
    code: zod_1.z.string().min(1, 'Code required'),
});
exports.disableTwoFactorSchema = zod_1.z.object({
    password: zod_1.z.string().min(1, 'Password required'),
    code: zod_1.z.string().min(1, 'Code required'),
});
exports.regenerateBackupCodesSchema = zod_1.z.object({
    password: zod_1.z.string().min(1, 'Password required'),
    code: zod_1.z.string().min(1, 'Code required'),
});
// Types are exported from api.types.ts
//# sourceMappingURL=auth.validators.js.map