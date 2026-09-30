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
/** Max data rows accepted by POST /customers/import (excludes header). */
export declare const CUSTOMER_IMPORT_MAX_ROWS = 2000;
/** Max upload size for patron CSV import (~2MB). */
export declare const CUSTOMER_IMPORT_MAX_BYTES: number;
export declare const CUSTOMER_IMPORT_TEMPLATE_HEADERS: readonly ["name", "email", "phone", "external_id", "tags", "notes", "birthday", "gender", "address_line1", "city", "region", "postal_code", "country", "marketing_sms_consent", "marketing_email_consent", "opening_points"];
export type CustomerImportTemplateHeader = (typeof CUSTOMER_IMPORT_TEMPLATE_HEADERS)[number];
export declare const CUSTOMER_IMPORT_ROW_STATUSES: readonly ["created", "updated", "error"];
export type CustomerImportRowStatus = (typeof CUSTOMER_IMPORT_ROW_STATUSES)[number];
/** Parse CSV consent cell → GRANTED, false → REVOKED, blank → undefined (leave unchanged). */
export declare function parseCustomerImportConsent(raw: string | undefined): boolean | undefined;
export declare const customerImportRowSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    email: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    phone: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, unknown>;
    externalId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    tags: z.ZodEffects<z.ZodOptional<z.ZodArray<z.ZodString, "many">>, string[] | undefined, unknown>;
    notes: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    birthday: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    gender: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    addressLine1: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    city: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    region: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    postalCode: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    country: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    marketingSmsConsent: z.ZodOptional<z.ZodBoolean>;
    marketingEmailConsent: z.ZodOptional<z.ZodBoolean>;
    openingPoints: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    notes?: string | undefined;
    country?: string | undefined;
    tags?: string[] | undefined;
    birthday?: string | undefined;
    gender?: string | undefined;
    city?: string | undefined;
    region?: string | undefined;
    externalId?: string | undefined;
    addressLine1?: string | undefined;
    postalCode?: string | undefined;
    openingPoints?: number | undefined;
}, {
    name: string;
    email?: unknown;
    phone?: unknown;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    notes?: unknown;
    country?: unknown;
    tags?: unknown;
    birthday?: unknown;
    gender?: unknown;
    city?: unknown;
    region?: unknown;
    externalId?: unknown;
    addressLine1?: unknown;
    postalCode?: unknown;
    openingPoints?: unknown;
}>, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    notes?: string | undefined;
    country?: string | undefined;
    tags?: string[] | undefined;
    birthday?: string | undefined;
    gender?: string | undefined;
    city?: string | undefined;
    region?: string | undefined;
    externalId?: string | undefined;
    addressLine1?: string | undefined;
    postalCode?: string | undefined;
    openingPoints?: number | undefined;
}, {
    name: string;
    email?: unknown;
    phone?: unknown;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
    notes?: unknown;
    country?: unknown;
    tags?: unknown;
    birthday?: unknown;
    gender?: unknown;
    city?: unknown;
    region?: unknown;
    externalId?: unknown;
    addressLine1?: unknown;
    postalCode?: unknown;
    openingPoints?: unknown;
}>;
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
//# sourceMappingURL=customer.validators.d.ts.map