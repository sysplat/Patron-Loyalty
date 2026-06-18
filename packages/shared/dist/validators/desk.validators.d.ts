import { z } from 'zod';
export declare const createDeskSchema: z.ZodObject<{
    branchId: z.ZodString;
    name: z.ZodString;
    number: z.ZodString;
}, "strip", z.ZodTypeAny, {
    number: string;
    name: string;
    branchId: string;
}, {
    number: string;
    name: string;
    branchId: string;
}>;
export declare const updateDeskSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["open", "closed", "available", "busy", "offline"]>>;
    defaultStationProfileId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    status?: "open" | "closed" | "offline" | "available" | "busy" | undefined;
    defaultStationProfileId?: string | null | undefined;
}, {
    name?: string | undefined;
    status?: "open" | "closed" | "offline" | "available" | "busy" | undefined;
    defaultStationProfileId?: string | null | undefined;
}>;
export declare const assignDeskSchema: z.ZodObject<{
    userIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    userIds: string[];
}, {
    userIds: string[];
}>;
//# sourceMappingURL=desk.validators.d.ts.map