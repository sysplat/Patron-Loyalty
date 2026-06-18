import { z } from 'zod';
export declare const listCustomersQuerySchema: z.ZodObject<{
    page: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
} & {
    branchId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    search: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    segment: z.ZodEffects<z.ZodOptional<z.ZodEnum<[string, ...string[]]>>, string | undefined, unknown>;
    savedSegmentId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    branchId?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    segment?: string | undefined;
    savedSegmentId?: string | undefined;
}, {
    search?: unknown;
    branchId?: unknown;
    page?: unknown;
    limit?: unknown;
    segment?: unknown;
    savedSegmentId?: unknown;
}>;
export declare const updateCustomerSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    notes?: string | undefined;
    tags?: string[] | undefined;
}, {
    name?: string | undefined;
    notes?: string | undefined;
    tags?: string[] | undefined;
}>;
export declare const createCustomerSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    phone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    marketingSmsConsent: z.ZodOptional<z.ZodBoolean>;
    marketingEmailConsent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>;
export declare const createCustomerSegmentSchema: z.ZodObject<{
    name: z.ZodString;
    filters: z.ZodObject<{
        preset: z.ZodOptional<z.ZodEnum<[string, ...string[]]>>;
        branchId: z.ZodOptional<z.ZodString>;
        search: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        search?: string | undefined;
        branchId?: string | undefined;
        preset?: string | undefined;
    }, {
        search?: string | undefined;
        branchId?: string | undefined;
        preset?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    filters: {
        search?: string | undefined;
        branchId?: string | undefined;
        preset?: string | undefined;
    };
}, {
    name: string;
    filters: {
        search?: string | undefined;
        branchId?: string | undefined;
        preset?: string | undefined;
    };
}>;
//# sourceMappingURL=customer.validators.d.ts.map