import { z } from 'zod';
export declare const createBranchSchema: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
    timezone: z.ZodString;
    phone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    email: z.ZodOptional<z.ZodString>;
    defaultJourneyMode: z.ZodOptional<z.ZodEnum<["single_ticket", "visit_multi_step"]>>;
    initialDesksCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    timezone: string;
    email?: string | undefined;
    address?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    phone?: string | undefined;
    defaultJourneyMode?: "single_ticket" | "visit_multi_step" | undefined;
    initialDesksCount?: number | undefined;
}, {
    name: string;
    timezone: string;
    email?: string | undefined;
    address?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    phone?: string | undefined;
    defaultJourneyMode?: "single_ticket" | "visit_multi_step" | undefined;
    initialDesksCount?: number | undefined;
}>;
export declare const updateBranchSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lat: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    lng: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    timezone: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>>;
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    initialDesksCount: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
} & {
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "temporarily_closed"]>>;
    exceptionalCustomerNotice: z.ZodOptional<z.ZodBoolean>;
    exceptionalCustomerNoticeMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    defaultJourneyMode: z.ZodOptional<z.ZodEnum<["single_ticket", "visit_multi_step"]>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    name?: string | undefined;
    address?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    timezone?: string | undefined;
    phone?: string | undefined;
    status?: "active" | "inactive" | "temporarily_closed" | undefined;
    defaultJourneyMode?: "single_ticket" | "visit_multi_step" | undefined;
    initialDesksCount?: number | undefined;
    exceptionalCustomerNotice?: boolean | undefined;
    exceptionalCustomerNoticeMinutes?: number | null | undefined;
}, {
    email?: string | undefined;
    name?: string | undefined;
    address?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    timezone?: string | undefined;
    phone?: string | undefined;
    status?: "active" | "inactive" | "temporarily_closed" | undefined;
    defaultJourneyMode?: "single_ticket" | "visit_multi_step" | undefined;
    initialDesksCount?: number | undefined;
    exceptionalCustomerNotice?: boolean | undefined;
    exceptionalCustomerNoticeMinutes?: number | null | undefined;
}>;
/** Serve-page notice buffer — staff may update via queue:update (not full branch:update). */
export declare const updateBranchCustomerNoticeSchema: z.ZodEffects<z.ZodObject<{
    /** Optional branch context for branch-scoped RBAC (ignored when persisting). */
    branchId: z.ZodOptional<z.ZodString>;
    exceptionalCustomerNotice: z.ZodOptional<z.ZodBoolean>;
    exceptionalCustomerNoticeMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    branchId?: string | undefined;
    exceptionalCustomerNotice?: boolean | undefined;
    exceptionalCustomerNoticeMinutes?: number | null | undefined;
}, {
    branchId?: string | undefined;
    exceptionalCustomerNotice?: boolean | undefined;
    exceptionalCustomerNoticeMinutes?: number | null | undefined;
}>, {
    branchId?: string | undefined;
    exceptionalCustomerNotice?: boolean | undefined;
    exceptionalCustomerNoticeMinutes?: number | null | undefined;
}, {
    branchId?: string | undefined;
    exceptionalCustomerNotice?: boolean | undefined;
    exceptionalCustomerNoticeMinutes?: number | null | undefined;
}>;
export declare const setWorkingHoursSchema: z.ZodObject<{
    hours: z.ZodArray<z.ZodObject<{
        dayOfWeek: z.ZodNumber;
        openTime: z.ZodString;
        closeTime: z.ZodString;
        isClosed: z.ZodBoolean;
        breakStart: z.ZodOptional<z.ZodString>;
        breakEnd: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        isClosed: boolean;
        openTime: string;
        closeTime: string;
        dayOfWeek: number;
        breakStart?: string | undefined;
        breakEnd?: string | undefined;
    }, {
        isClosed: boolean;
        openTime: string;
        closeTime: string;
        dayOfWeek: number;
        breakStart?: string | undefined;
        breakEnd?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    hours: {
        isClosed: boolean;
        openTime: string;
        closeTime: string;
        dayOfWeek: number;
        breakStart?: string | undefined;
        breakEnd?: string | undefined;
    }[];
}, {
    hours: {
        isClosed: boolean;
        openTime: string;
        closeTime: string;
        dayOfWeek: number;
        breakStart?: string | undefined;
        breakEnd?: string | undefined;
    }[];
}>;
export declare const upsertDateOverrideSchema: z.ZodObject<{
    date: z.ZodString;
    openTime: z.ZodOptional<z.ZodString>;
    closeTime: z.ZodOptional<z.ZodString>;
    isClosed: z.ZodBoolean;
    breakStart: z.ZodOptional<z.ZodString>;
    breakEnd: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    isClosed: boolean;
    date: string;
    openTime?: string | undefined;
    closeTime?: string | undefined;
    breakStart?: string | undefined;
    breakEnd?: string | undefined;
    note?: string | undefined;
}, {
    isClosed: boolean;
    date: string;
    openTime?: string | undefined;
    closeTime?: string | undefined;
    breakStart?: string | undefined;
    breakEnd?: string | undefined;
    note?: string | undefined;
}>;
//# sourceMappingURL=branch.validators.d.ts.map