import { z } from 'zod';
export declare const createRoleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    permissionIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    permissionIds: string[];
    description?: string | undefined;
}, {
    name: string;
    permissionIds: string[];
    description?: string | undefined;
}>;
export declare const updateRoleSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
}>;
export declare const updateRolePermissionsSchema: z.ZodObject<{
    permissionIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    permissionIds: string[];
}, {
    permissionIds: string[];
}>;
export declare const assignRoleSchema: z.ZodObject<{
    userId: z.ZodString;
    roleId: z.ZodString;
    branchId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roleId: string;
    userId: string;
    branchId?: string | undefined;
}, {
    roleId: string;
    userId: string;
    branchId?: string | undefined;
}>;
//# sourceMappingURL=role.validators.d.ts.map