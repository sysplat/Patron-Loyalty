import { z } from 'zod';
export declare const issueTicketSchema: z.ZodEffects<z.ZodObject<{
    queueId: z.ZodString;
    branchId: z.ZodString;
    serviceId: z.ZodString;
    deskNumber: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    customerEmail: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodEnum<["walk_in", "online", "kiosk", "staff", "public"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    language: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    transactionalSmsAllowed: z.ZodOptional<z.ZodBoolean>;
    marketingSmsConsent: z.ZodOptional<z.ZodBoolean>;
    marketingEmailConsent: z.ZodOptional<z.ZodBoolean>;
    orgId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    orgId?: string | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    branchId: string;
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    orgId?: string | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>, {
    branchId: string;
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    orgId?: string | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    branchId: string;
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    orgId?: string | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>;
export declare const issueTicketStaffSchema: z.ZodObject<{
    queueId: z.ZodString;
    branchId: z.ZodString;
    serviceId: z.ZodString;
    deskNumber: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    customerEmail: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodEnum<["walk_in", "online", "kiosk", "staff", "public"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    language: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    transactionalSmsAllowed: z.ZodOptional<z.ZodBoolean>;
    marketingSmsConsent: z.ZodOptional<z.ZodBoolean>;
    marketingEmailConsent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    branchId: string;
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>;
export declare const publicJoinQueueSchema: z.ZodEffects<z.ZodObject<{
    orgId: z.ZodString;
    branchId: z.ZodString;
    queueId: z.ZodString;
    serviceId: z.ZodString;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    language: z.ZodOptional<z.ZodString>;
    transactionalSmsAllowed: z.ZodOptional<z.ZodBoolean>;
    marketingSmsConsent: z.ZodOptional<z.ZodBoolean>;
    marketingEmailConsent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    orgId: string;
    serviceId: string;
    queueId: string;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    branchId: string;
    orgId: string;
    serviceId: string;
    queueId: string;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>, {
    branchId: string;
    orgId: string;
    serviceId: string;
    queueId: string;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    branchId: string;
    orgId: string;
    serviceId: string;
    queueId: string;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>;
export declare const createVisitStepSchema: z.ZodEffects<z.ZodObject<{
    queueId: z.ZodString;
    serviceId: z.ZodString;
    deskNumber: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    language: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodEnum<["walk_in", "online", "kiosk", "staff", "public"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    transactionalSmsAllowed: z.ZodOptional<z.ZodBoolean>;
    marketingSmsConsent: z.ZodOptional<z.ZodBoolean>;
    marketingEmailConsent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>, {
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}, {
    serviceId: string;
    queueId: string;
    priority?: number | undefined;
    note?: string | undefined;
    deskNumber?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
    language?: string | undefined;
    transactionalSmsAllowed?: boolean | undefined;
    marketingSmsConsent?: boolean | undefined;
    marketingEmailConsent?: boolean | undefined;
}>;
export declare const bookTicketSchema: z.ZodObject<{
    queueId: z.ZodString;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string | undefined, string>>;
    customerEmail: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodOptional<z.ZodEnum<["walk_in", "online", "kiosk", "staff", "public"]>>>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    priority: number;
    queueId: string;
    source: "walk_in" | "online" | "kiosk" | "staff" | "public";
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
}, {
    queueId: string;
    priority?: number | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    source?: "walk_in" | "online" | "kiosk" | "staff" | "public" | undefined;
}>;
export declare const callNextTicketSchema: z.ZodObject<{
    queueId: z.ZodString;
    deskNumber: z.ZodString;
    deskFilterActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    queueId: string;
    deskNumber: string;
    deskFilterActive?: boolean | undefined;
}, {
    queueId: string;
    deskNumber: string;
    deskFilterActive?: boolean | undefined;
}>;
/** Classic single-step: call a specific waiting ticket (manual / ready-then-manual policies). */
export declare const callWaitingTicketSchema: z.ZodObject<{
    ticketId: z.ZodString;
    deskNumber: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ticketId: string;
    deskNumber: string;
}, {
    ticketId: string;
    deskNumber: string;
}>;
export declare const ticketIdBodySchema: z.ZodObject<{
    ticketId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ticketId: string;
}, {
    ticketId: string;
}>;
export declare const ticketIdsBodySchema: z.ZodObject<{
    ticketIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    ticketIds: string[];
}, {
    ticketIds: string[];
}>;
export declare const anonymizeCustomerSchema: z.ZodObject<{
    customerId: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    dryRun?: boolean | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    customerId?: string | undefined;
    dryRun?: boolean | undefined;
}>;
export declare const updateTicketEstimatesSchema: z.ZodObject<{
    estimatedRemainingMins: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    estimatedRemainingMins?: number | null | undefined;
}, {
    estimatedRemainingMins?: number | null | undefined;
}>;
export declare const completeTicketBodySchema: z.ZodObject<{
    externalRef: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    externalRef?: string | undefined;
}, {
    externalRef?: string | undefined;
}>;
export declare const cancelTicketSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export declare const transferTicketBodySchema: z.ZodObject<{
    targetQueueId: z.ZodOptional<z.ZodString>;
    targetDeskNumber: z.ZodOptional<z.ZodString>;
    externalRef: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    externalRef?: string | undefined;
    targetQueueId?: string | undefined;
    targetDeskNumber?: string | undefined;
}, {
    externalRef?: string | undefined;
    targetQueueId?: string | undefined;
    targetDeskNumber?: string | undefined;
}>;
export declare const changeDeskTicketSchema: z.ZodObject<{
    targetDeskNumber: z.ZodString;
}, "strip", z.ZodTypeAny, {
    targetDeskNumber: string;
}, {
    targetDeskNumber: string;
}>;
/** @deprecated Legacy shape; prefer callWaitingTicketSchema for agent console row calls. */
export declare const callTicketSchema: z.ZodObject<{
    queueId: z.ZodString;
    deskNumber: z.ZodOptional<z.ZodString>;
    staffUserId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    queueId: string;
    staffUserId: string;
    deskNumber?: string | undefined;
}, {
    queueId: string;
    staffUserId: string;
    deskNumber?: string | undefined;
}>;
export declare const transferTicketSchema: z.ZodObject<{
    targetQueueId: z.ZodString;
    targetDeskNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    targetQueueId: string;
    targetDeskNumber?: string | undefined;
}, {
    targetQueueId: string;
    targetDeskNumber?: string | undefined;
}>;
export declare const updateTicketPreferencesSchema: z.ZodObject<{
    transactionalSmsAllowed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    transactionalSmsAllowed: boolean;
}, {
    transactionalSmsAllowed: boolean;
}>;
//# sourceMappingURL=ticket.validators.d.ts.map