import { z } from 'zod';
export declare const inviteUserSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    roleId: z.ZodString;
    password: z.ZodString;
    branchIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    roleId: string;
    branchIds?: string[] | undefined;
}, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    roleId: string;
    branchIds?: string[] | undefined;
}>;
export declare const setUserPasswordSchema: z.ZodObject<{
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
}, {
    password: string;
}>;
export declare const updateUserSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodString>;
    roleId: z.ZodOptional<z.ZodString>;
    branchIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    timezone?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    branchIds?: string[] | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    language?: string | undefined;
    roleId?: string | undefined;
    avatarUrl?: string | undefined;
}, {
    timezone?: string | undefined;
    phone?: string | undefined;
    description?: string | undefined;
    branchIds?: string[] | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    language?: string | undefined;
    roleId?: string | undefined;
    avatarUrl?: string | undefined;
}>;
//# sourceMappingURL=user.validators.d.ts.map