import { z } from 'zod';
export declare const createQueueSchema: z.ZodEffects<z.ZodObject<{
    branchId: z.ZodString;
    serviceId: z.ZodString;
    name: z.ZodString;
    prefix: z.ZodString;
    maxCapacity: z.ZodOptional<z.ZodNumber>;
    journeyModeOverride: z.ZodOptional<z.ZodEnum<["single_ticket", "visit_multi_step"]>>;
    stepRole: z.ZodOptional<z.ZodNullable<z.ZodEnum<["service", "pickup"]>>>;
    callingPolicy: z.ZodOptional<z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>>;
    flowTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    branchId: string;
    serviceId: string;
    prefix: string;
    flowTemplateId?: string | null | undefined;
    journeyModeOverride?: "single_ticket" | "visit_multi_step" | undefined;
    maxCapacity?: number | undefined;
    stepRole?: "service" | "pickup" | null | undefined;
    callingPolicy?: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo" | undefined;
}, {
    name: string;
    branchId: string;
    serviceId: string;
    prefix: string;
    flowTemplateId?: string | null | undefined;
    journeyModeOverride?: "single_ticket" | "visit_multi_step" | undefined;
    maxCapacity?: number | undefined;
    stepRole?: "service" | "pickup" | null | undefined;
    callingPolicy?: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo" | undefined;
}>, {
    name: string;
    branchId: string;
    serviceId: string;
    prefix: string;
    flowTemplateId?: string | null | undefined;
    journeyModeOverride?: "single_ticket" | "visit_multi_step" | undefined;
    maxCapacity?: number | undefined;
    stepRole?: "service" | "pickup" | null | undefined;
    callingPolicy?: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo" | undefined;
}, {
    name: string;
    branchId: string;
    serviceId: string;
    prefix: string;
    flowTemplateId?: string | null | undefined;
    journeyModeOverride?: "single_ticket" | "visit_multi_step" | undefined;
    maxCapacity?: number | undefined;
    stepRole?: "service" | "pickup" | null | undefined;
    callingPolicy?: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo" | undefined;
}>;
export declare const updateQueueSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    prefix: z.ZodOptional<z.ZodString>;
    maxCapacity: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    branchId: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    journeyModeOverride: z.ZodOptional<z.ZodNullable<z.ZodEnum<["single_ticket", "visit_multi_step"]>>>;
    stepRole: z.ZodOptional<z.ZodNullable<z.ZodEnum<["service", "pickup"]>>>;
    callingPolicy: z.ZodOptional<z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>>;
    flowTemplateId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    branchId?: string | undefined;
    flowTemplateId?: string | null | undefined;
    journeyModeOverride?: "single_ticket" | "visit_multi_step" | null | undefined;
    serviceId?: string | undefined;
    prefix?: string | undefined;
    maxCapacity?: number | null | undefined;
    stepRole?: "service" | "pickup" | null | undefined;
    callingPolicy?: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo" | undefined;
}, {
    name?: string | undefined;
    branchId?: string | undefined;
    flowTemplateId?: string | null | undefined;
    journeyModeOverride?: "single_ticket" | "visit_multi_step" | null | undefined;
    serviceId?: string | undefined;
    prefix?: string | undefined;
    maxCapacity?: number | null | undefined;
    stepRole?: "service" | "pickup" | null | undefined;
    callingPolicy?: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo" | undefined;
}>, {
    name?: string | undefined;
    branchId?: string | undefined;
    flowTemplateId?: string | null | undefined;
    journeyModeOverride?: "single_ticket" | "visit_multi_step" | null | undefined;
    serviceId?: string | undefined;
    prefix?: string | undefined;
    maxCapacity?: number | null | undefined;
    stepRole?: "service" | "pickup" | null | undefined;
    callingPolicy?: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo" | undefined;
}, {
    name?: string | undefined;
    branchId?: string | undefined;
    flowTemplateId?: string | null | undefined;
    journeyModeOverride?: "single_ticket" | "visit_multi_step" | null | undefined;
    serviceId?: string | undefined;
    prefix?: string | undefined;
    maxCapacity?: number | null | undefined;
    stepRole?: "service" | "pickup" | null | undefined;
    callingPolicy?: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo" | undefined;
}>;
export declare const stopQueueSchema: z.ZodObject<{
    forceCloseWaiting: z.ZodOptional<z.ZodBoolean>;
    acknowledgeConsequences: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    forceCloseWaiting?: boolean | undefined;
    acknowledgeConsequences?: boolean | undefined;
}, {
    forceCloseWaiting?: boolean | undefined;
    acknowledgeConsequences?: boolean | undefined;
}>;
//# sourceMappingURL=queue.validators.d.ts.map