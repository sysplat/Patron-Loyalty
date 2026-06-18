import { z } from 'zod';
export declare const stationProfileQueueSchema: z.ZodObject<{
    queueId: z.ZodString;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    visibilityOnly: z.ZodOptional<z.ZodBoolean>;
    capabilities: z.ZodOptional<z.ZodArray<z.ZodEnum<[string, ...string[]]>, "many">>;
}, "strip", z.ZodTypeAny, {
    queueId: string;
    sortOrder?: number | undefined;
    visibilityOnly?: boolean | undefined;
    capabilities?: string[] | undefined;
}, {
    queueId: string;
    sortOrder?: number | undefined;
    visibilityOnly?: boolean | undefined;
    capabilities?: string[] | undefined;
}>;
export declare const createStationProfileSchema: z.ZodObject<{
    branchId: z.ZodString;
    name: z.ZodString;
    primaryQueueId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    flowTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
    queues: z.ZodArray<z.ZodObject<{
        queueId: z.ZodString;
        sortOrder: z.ZodOptional<z.ZodNumber>;
        visibilityOnly: z.ZodOptional<z.ZodBoolean>;
        capabilities: z.ZodOptional<z.ZodArray<z.ZodEnum<[string, ...string[]]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        queueId: string;
        sortOrder?: number | undefined;
        visibilityOnly?: boolean | undefined;
        capabilities?: string[] | undefined;
    }, {
        queueId: string;
        sortOrder?: number | undefined;
        visibilityOnly?: boolean | undefined;
        capabilities?: string[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    branchId: string;
    queues: {
        queueId: string;
        sortOrder?: number | undefined;
        visibilityOnly?: boolean | undefined;
        capabilities?: string[] | undefined;
    }[];
    flowTemplateId?: string | null | undefined;
    primaryQueueId?: string | null | undefined;
    isDefault?: boolean | undefined;
}, {
    name: string;
    branchId: string;
    queues: {
        queueId: string;
        sortOrder?: number | undefined;
        visibilityOnly?: boolean | undefined;
        capabilities?: string[] | undefined;
    }[];
    flowTemplateId?: string | null | undefined;
    primaryQueueId?: string | null | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const updateStationProfileSchema: z.ZodObject<{
    branchId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    primaryQueueId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    flowTemplateId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    isDefault: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    queues: z.ZodOptional<z.ZodArray<z.ZodObject<{
        queueId: z.ZodString;
        sortOrder: z.ZodOptional<z.ZodNumber>;
        visibilityOnly: z.ZodOptional<z.ZodBoolean>;
        capabilities: z.ZodOptional<z.ZodArray<z.ZodEnum<[string, ...string[]]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        queueId: string;
        sortOrder?: number | undefined;
        visibilityOnly?: boolean | undefined;
        capabilities?: string[] | undefined;
    }, {
        queueId: string;
        sortOrder?: number | undefined;
        visibilityOnly?: boolean | undefined;
        capabilities?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    branchId?: string | undefined;
    flowTemplateId?: string | null | undefined;
    primaryQueueId?: string | null | undefined;
    isDefault?: boolean | undefined;
    queues?: {
        queueId: string;
        sortOrder?: number | undefined;
        visibilityOnly?: boolean | undefined;
        capabilities?: string[] | undefined;
    }[] | undefined;
}, {
    name?: string | undefined;
    branchId?: string | undefined;
    flowTemplateId?: string | null | undefined;
    primaryQueueId?: string | null | undefined;
    isDefault?: boolean | undefined;
    queues?: {
        queueId: string;
        sortOrder?: number | undefined;
        visibilityOnly?: boolean | undefined;
        capabilities?: string[] | undefined;
    }[] | undefined;
}>;
export declare const startAgentSessionSchema: z.ZodObject<{
    branchId: z.ZodString;
    stationProfileId: z.ZodString;
    deskId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    deskNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    surface: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    stationProfileId: string;
    deskNumber?: string | null | undefined;
    deskId?: string | null | undefined;
    surface?: string | undefined;
}, {
    branchId: string;
    stationProfileId: string;
    deskNumber?: string | null | undefined;
    deskId?: string | null | undefined;
    surface?: string | undefined;
}>;
export declare const agentSessionHeartbeatSchema: z.ZodObject<{
    sessionId: z.ZodOptional<z.ZodString>;
    surface: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    surface?: string | undefined;
    sessionId?: string | undefined;
}, {
    surface?: string | undefined;
    sessionId?: string | undefined;
}>;
export declare const workbenchSessionSchema: z.ZodObject<{
    branchId: z.ZodString;
    deskNumber: z.ZodString;
    stationProfileId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    branchId: string;
    deskNumber: string;
    stationProfileId?: string | undefined;
}, {
    branchId: string;
    deskNumber: string;
    stationProfileId?: string | undefined;
}>;
export declare const workbenchCallNextSchema: z.ZodObject<{
    stationProfileId: z.ZodString;
    queueId: z.ZodString;
    deskNumber: z.ZodString;
    deskFilterActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    queueId: string;
    deskNumber: string;
    stationProfileId: string;
    deskFilterActive?: boolean | undefined;
}, {
    queueId: string;
    deskNumber: string;
    stationProfileId: string;
    deskFilterActive?: boolean | undefined;
}>;
export declare const workbenchCallSpecificSchema: z.ZodObject<{
    deskNumber: z.ZodString;
    stationProfileId: z.ZodString;
    ticketId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ticketId: string;
    deskNumber: string;
    stationProfileId: string;
}, {
    ticketId: string;
    deskNumber: string;
    stationProfileId: string;
}>;
export declare const workbenchTicketActionSchema: z.ZodObject<{
    stationProfileId: z.ZodString;
    ticketId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ticketId: string;
    stationProfileId: string;
}, {
    ticketId: string;
    stationProfileId: string;
}>;
export declare const workbenchCompleteSchema: z.ZodObject<{
    externalRef: z.ZodOptional<z.ZodString>;
    stationProfileId: z.ZodString;
    ticketId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ticketId: string;
    stationProfileId: string;
    externalRef?: string | undefined;
}, {
    ticketId: string;
    stationProfileId: string;
    externalRef?: string | undefined;
}>;
export declare const workbenchCancelSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
    stationProfileId: z.ZodString;
    ticketId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ticketId: string;
    stationProfileId: string;
    reason?: string | undefined;
}, {
    ticketId: string;
    stationProfileId: string;
    reason?: string | undefined;
}>;
//# sourceMappingURL=workbench.validators.d.ts.map