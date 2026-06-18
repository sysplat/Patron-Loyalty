import { z } from 'zod';
export declare const paginationQuerySchema: z.ZodObject<{
    page: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    page?: number | undefined;
    limit?: number | undefined;
}, {
    page?: unknown;
    limit?: unknown;
}>;
export declare const optionalUuidQuery: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
export declare const optionalSearchQuery: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
export declare const listTicketsQuerySchema: z.ZodObject<{
    page: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
} & {
    branchId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    queueId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    status: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    date: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    dateFrom: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    dateTo: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    search: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    period: z.ZodEffects<z.ZodOptional<z.ZodEnum<["today", "week"]>>, "week" | "today" | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    search?: string | undefined;
    branchId?: string | undefined;
    date?: string | undefined;
    queueId?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    period?: "week" | "today" | undefined;
}, {
    status?: unknown;
    search?: unknown;
    branchId?: unknown;
    date?: unknown;
    queueId?: unknown;
    page?: unknown;
    limit?: unknown;
    dateFrom?: unknown;
    dateTo?: unknown;
    period?: unknown;
}>;
export declare const listUsersQuerySchema: z.ZodObject<{
    page: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
} & {
    status: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    search: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}, {
    status?: unknown;
    search?: unknown;
    page?: unknown;
    limit?: unknown;
}>;
export declare const listAppointmentsQuerySchema: z.ZodObject<{
    page: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    limit: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
} & {
    branchId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    serviceId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    status: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    from: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    to: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
    search: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, unknown>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    search?: string | undefined;
    branchId?: string | undefined;
    serviceId?: string | undefined;
    to?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    from?: string | undefined;
}, {
    status?: unknown;
    search?: unknown;
    branchId?: unknown;
    serviceId?: unknown;
    to?: unknown;
    page?: unknown;
    limit?: unknown;
    from?: unknown;
}>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
//# sourceMappingURL=query.validators.d.ts.map