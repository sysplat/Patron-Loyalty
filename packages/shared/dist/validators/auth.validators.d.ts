import { z } from 'zod';
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
export declare const passwordSchema: z.ZodString;
export declare const registerSchema: z.ZodEffects<z.ZodObject<{
    businessName: z.ZodOptional<z.ZodString>;
    organizationName: z.ZodOptional<z.ZodString>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    password: z.ZodString;
    phone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    acceptLegal: z.ZodLiteral<true>;
    /** `loyalty` = standalone LMS; `qms` (default) = queue; `bundle` = both. */
    productSku: z.ZodOptional<z.ZodEnum<[import("../constants/product").ProductSku, ...import("../constants/product").ProductSku[]]>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    acceptLegal: true;
    phone?: string | undefined;
    businessName?: string | undefined;
    organizationName?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    productSku?: import("../constants/product").ProductSku | undefined;
}, {
    email: string;
    password: string;
    acceptLegal: true;
    phone?: string | undefined;
    businessName?: string | undefined;
    organizationName?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    productSku?: import("../constants/product").ProductSku | undefined;
}>, {
    email: string;
    password: string;
    acceptLegal: true;
    phone?: string | undefined;
    businessName?: string | undefined;
    organizationName?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    productSku?: import("../constants/product").ProductSku | undefined;
}, {
    email: string;
    password: string;
    acceptLegal: true;
    phone?: string | undefined;
    businessName?: string | undefined;
    organizationName?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    productSku?: import("../constants/product").ProductSku | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    orgId: z.ZodOptional<z.ZodString>;
    platformAdmin: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    orgId?: string | undefined;
    platformAdmin?: boolean | undefined;
}, {
    email: string;
    password: string;
    orgId?: string | undefined;
    platformAdmin?: boolean | undefined;
}>;
export declare const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const twoFactorLoginSchema: z.ZodObject<{
    twoFactorToken: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    twoFactorToken: string;
}, {
    code: string;
    twoFactorToken: string;
}>;
export declare const enableTwoFactorSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export declare const disableTwoFactorSchema: z.ZodObject<{
    password: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    password: string;
}, {
    code: string;
    password: string;
}>;
export declare const regenerateBackupCodesSchema: z.ZodObject<{
    password: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    password: string;
}, {
    code: string;
    password: string;
}>;
//# sourceMappingURL=auth.validators.d.ts.map