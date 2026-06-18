import { z } from 'zod';
export declare const bulkTenantSuspendSchema: z.ZodObject<{
    organizationIds: z.ZodArray<z.ZodString, "many">;
    suspend: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    organizationIds: string[];
    suspend: boolean;
}, {
    organizationIds: string[];
    suspend: boolean;
}>;
export declare const tenantSuspendSchema: z.ZodObject<{
    suspend: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    suspend: boolean;
}, {
    suspend: boolean;
}>;
export declare const tenantVisitJourneysSchema: z.ZodObject<{
    visitJourneysEnabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    visitJourneysEnabled: boolean;
}, {
    visitJourneysEnabled: boolean;
}>;
export declare const tenantAppointmentsSchema: z.ZodObject<{
    appointmentsEnabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    appointmentsEnabled: boolean;
}, {
    appointmentsEnabled: boolean;
}>;
export declare const tenantPatronCrmSchema: z.ZodObject<{
    patronCrmEnabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    patronCrmEnabled: boolean;
}, {
    patronCrmEnabled: boolean;
}>;
export declare const tenantPlanSlugSchema: z.ZodObject<{
    planSlug: z.ZodString;
}, "strip", z.ZodTypeAny, {
    planSlug: string;
}, {
    planSlug: string;
}>;
export declare const createPlatformAdminSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}>;
export declare const platformImpersonationSchema: z.ZodObject<{
    orgId: z.ZodString;
    /** When set, enforces RBAC for that system role instead of full support bypass. */
    role: z.ZodOptional<z.ZodEnum<["owner", "admin", "manager", "staff", "viewer"]>>;
    /** Required for manager/staff/viewer simulation; auto-picked when omitted. */
    branchId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    role?: "staff" | "owner" | "admin" | "manager" | "viewer" | undefined;
    branchId?: string | undefined;
}, {
    orgId: string;
    role?: "staff" | "owner" | "admin" | "manager" | "viewer" | undefined;
    branchId?: string | undefined;
}>;
export declare const platformDataPurgeDryRunSchema: z.ZodObject<{
    orgId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orgId: string;
}, {
    orgId: string;
}>;
export declare const platformDataPurgeSchema: z.ZodObject<{
    orgId: z.ZodString;
    confirmation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    confirmation: string;
}, {
    orgId: string;
    confirmation: string;
}>;
export declare const platformAnnouncementSchema: z.ZodObject<{
    deliveryMode: z.ZodOptional<z.ZodEnum<["banner", "modal", "blocking"]>>;
    dismissBehavior: z.ZodOptional<z.ZodEnum<["allowed", "disallowed"]>>;
    requireAcknowledgment: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodString;
    body: z.ZodString;
    type: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    body: string;
    title: string;
    deliveryMode?: "banner" | "modal" | "blocking" | undefined;
    dismissBehavior?: "allowed" | "disallowed" | undefined;
    requireAcknowledgment?: boolean | undefined;
}, {
    type: string;
    body: string;
    title: string;
    deliveryMode?: "banner" | "modal" | "blocking" | undefined;
    dismissBehavior?: "allowed" | "disallowed" | undefined;
    requireAcknowledgment?: boolean | undefined;
}>;
export declare const updatePlatformAnnouncementSchema: z.ZodObject<{
    deliveryMode: z.ZodOptional<z.ZodEnum<["banner", "modal", "blocking"]>>;
    dismissBehavior: z.ZodOptional<z.ZodEnum<["allowed", "disallowed"]>>;
    requireAcknowledgment: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
    deliveryMode?: "banner" | "modal" | "blocking" | undefined;
    dismissBehavior?: "allowed" | "disallowed" | undefined;
    requireAcknowledgment?: boolean | undefined;
    body?: string | undefined;
    title?: string | undefined;
    isActive?: boolean | undefined;
}, {
    type?: string | undefined;
    deliveryMode?: "banner" | "modal" | "blocking" | undefined;
    dismissBehavior?: "allowed" | "disallowed" | undefined;
    requireAcknowledgment?: boolean | undefined;
    body?: string | undefined;
    title?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const updateTenantProfileSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    website: z.ZodNullable<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
    industry: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    timezone: z.ZodOptional<z.ZodString>;
    country: z.ZodNullable<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    timezone?: string | undefined;
    slug?: string | undefined;
    website?: string | null | undefined;
    industry?: string | null | undefined;
    country?: string | null | undefined;
}, {
    name?: string | undefined;
    timezone?: string | undefined;
    slug?: string | undefined;
    website?: string | null | undefined;
    industry?: string | null | undefined;
    country?: string | null | undefined;
}>;
//# sourceMappingURL=platform.validators.d.ts.map