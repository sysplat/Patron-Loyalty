import { z } from 'zod';
export declare const createSupportRequestSchema: z.ZodObject<{
    subject: z.ZodString;
    message: z.ZodString;
    priority: z.ZodOptional<z.ZodEnum<["low", "normal", "high"]>>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    subject: string;
    priority?: "normal" | "low" | "high" | undefined;
    category?: string | undefined;
}, {
    message: string;
    subject: string;
    priority?: "normal" | "low" | "high" | undefined;
    category?: string | undefined;
}>;
export declare const supportMessageSchema: z.ZodObject<{
    message: z.ZodString;
    /** Platform-operator internal note (platform admin API only). */
    isInternal: z.ZodOptional<z.ZodBoolean>;
    /** Org-only note; not sent to QlessQ support. */
    isOrgInternal: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    message: string;
    isInternal?: boolean | undefined;
    isOrgInternal?: boolean | undefined;
}, {
    message: string;
    isInternal?: boolean | undefined;
    isOrgInternal?: boolean | undefined;
}>;
export declare const reassignSupportContactSchema: z.ZodObject<{
    contactUserId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contactUserId: string;
}, {
    contactUserId: string;
}>;
export declare const updateSupportRequestSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    assignedToUserId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    priority?: string | undefined;
    status?: string | undefined;
    category?: string | undefined;
    assignedToUserId?: string | null | undefined;
}, {
    priority?: string | undefined;
    status?: string | undefined;
    category?: string | undefined;
    assignedToUserId?: string | null | undefined;
}>;
//# sourceMappingURL=support.validators.d.ts.map