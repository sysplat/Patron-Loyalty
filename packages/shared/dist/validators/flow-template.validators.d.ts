import { z } from 'zod';
export declare const createFlowTemplateSchema: z.ZodEffects<z.ZodObject<{
    branchId: z.ZodString;
    name: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        stepIndex: z.ZodNumber;
        deskNumber: z.ZodString;
        serviceId: z.ZodString;
        queueId: z.ZodString;
        stepRole: z.ZodEnum<["service", "pickup"]>;
        callingPolicy: z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>;
    }, "strip", z.ZodTypeAny, {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }, {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    branchId: string;
    steps: {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }[];
}, {
    name: string;
    branchId: string;
    steps: {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }[];
}>, {
    name: string;
    branchId: string;
    steps: {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }[];
}, {
    name: string;
    branchId: string;
    steps: {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }[];
}>;
export declare const updateFlowTemplateSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    steps: z.ZodOptional<z.ZodArray<z.ZodObject<{
        stepIndex: z.ZodNumber;
        deskNumber: z.ZodString;
        serviceId: z.ZodString;
        queueId: z.ZodString;
        stepRole: z.ZodEnum<["service", "pickup"]>;
        callingPolicy: z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>;
    }, "strip", z.ZodTypeAny, {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }, {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    steps?: {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }[] | undefined;
}, {
    name?: string | undefined;
    steps?: {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }[] | undefined;
}>, {
    name?: string | undefined;
    steps?: {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }[] | undefined;
}, {
    name?: string | undefined;
    steps?: {
        serviceId: string;
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        queueId: string;
        deskNumber: string;
        stepIndex: number;
    }[] | undefined;
}>;
//# sourceMappingURL=flow-template.validators.d.ts.map