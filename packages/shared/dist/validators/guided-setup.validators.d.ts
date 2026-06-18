import { z } from 'zod';
export declare const guidedServiceInputSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
    mode: z.ZodLiteral<"new">;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    durationMinutes: z.ZodNumber;
    serviceEstimateLowMinutes: z.ZodNumber;
    serviceEstimateHighMinutes: z.ZodNumber;
    instructionalTip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    durationMinutes: number;
    serviceEstimateLowMinutes: number;
    serviceEstimateHighMinutes: number;
    mode: "new";
    description?: string | undefined;
    instructionalTip?: string | null | undefined;
}, {
    name: string;
    durationMinutes: number;
    serviceEstimateLowMinutes: number;
    serviceEstimateHighMinutes: number;
    mode: "new";
    description?: string | undefined;
    instructionalTip?: string | null | undefined;
}>, z.ZodObject<{
    mode: z.ZodLiteral<"existing">;
    serviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    serviceId: string;
    mode: "existing";
}, {
    serviceId: string;
    mode: "existing";
}>]>, {
    name: string;
    durationMinutes: number;
    serviceEstimateLowMinutes: number;
    serviceEstimateHighMinutes: number;
    mode: "new";
    description?: string | undefined;
    instructionalTip?: string | null | undefined;
} | {
    serviceId: string;
    mode: "existing";
}, {
    name: string;
    durationMinutes: number;
    serviceEstimateLowMinutes: number;
    serviceEstimateHighMinutes: number;
    mode: "new";
    description?: string | undefined;
    instructionalTip?: string | null | undefined;
} | {
    serviceId: string;
    mode: "existing";
}>;
export declare const guidedSingleQueueInputSchema: z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
    mode: z.ZodLiteral<"new">;
    name: z.ZodString;
    prefix: z.ZodString;
    callingPolicy: z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    prefix: string;
    callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
    mode: "new";
}, {
    name: string;
    prefix: string;
    callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
    mode: "new";
}>, z.ZodObject<{
    mode: z.ZodLiteral<"existing">;
    queueId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    queueId: string;
    mode: "existing";
}, {
    queueId: string;
    mode: "existing";
}>]>;
export declare const guidedSetupSingleDeploySchema: z.ZodObject<{
    flowType: z.ZodLiteral<"single">;
    branchId: z.ZodString;
    service: z.ZodEffects<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"new">;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        durationMinutes: z.ZodNumber;
        serviceEstimateLowMinutes: z.ZodNumber;
        serviceEstimateHighMinutes: z.ZodNumber;
        instructionalTip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    }, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"existing">;
        serviceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        serviceId: string;
        mode: "existing";
    }, {
        serviceId: string;
        mode: "existing";
    }>]>, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    }, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    }>;
    queue: z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"new">;
        name: z.ZodString;
        prefix: z.ZodString;
        callingPolicy: z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        prefix: string;
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        mode: "new";
    }, {
        name: string;
        prefix: string;
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        mode: "new";
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"existing">;
        queueId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        queueId: string;
        mode: "existing";
    }, {
        queueId: string;
        mode: "existing";
    }>]>;
}, "strip", z.ZodTypeAny, {
    service: {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    };
    queue: {
        name: string;
        prefix: string;
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        mode: "new";
    } | {
        queueId: string;
        mode: "existing";
    };
    branchId: string;
    flowType: "single";
}, {
    service: {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    };
    queue: {
        name: string;
        prefix: string;
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        mode: "new";
    } | {
        queueId: string;
        mode: "existing";
    };
    branchId: string;
    flowType: "single";
}>;
export declare const guidedSetupMultiDeploySchema: z.ZodObject<{
    flowType: z.ZodLiteral<"multi">;
    branchId: z.ZodString;
    service: z.ZodEffects<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"new">;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        durationMinutes: z.ZodNumber;
        serviceEstimateLowMinutes: z.ZodNumber;
        serviceEstimateHighMinutes: z.ZodNumber;
        instructionalTip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    }, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"existing">;
        serviceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        serviceId: string;
        mode: "existing";
    }, {
        serviceId: string;
        mode: "existing";
    }>]>, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    }, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    }>;
    templateName: z.ZodString;
    autoActivate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    steps: z.ZodArray<z.ZodObject<{
        deskNumber: z.ZodString;
        stepRole: z.ZodEnum<["service", "pickup"]>;
        callingPolicy: z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>;
        queue: z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
            mode: z.ZodLiteral<"new">;
            name: z.ZodString;
            prefix: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            prefix: string;
            mode: "new";
        }, {
            name: string;
            prefix: string;
            mode: "new";
        }>, z.ZodObject<{
            mode: z.ZodLiteral<"existing">;
            queueId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            queueId: string;
            mode: "existing";
        }, {
            queueId: string;
            mode: "existing";
        }>]>;
    }, "strip", z.ZodTypeAny, {
        queue: {
            name: string;
            prefix: string;
            mode: "new";
        } | {
            queueId: string;
            mode: "existing";
        };
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        deskNumber: string;
    }, {
        queue: {
            name: string;
            prefix: string;
            mode: "new";
        } | {
            queueId: string;
            mode: "existing";
        };
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        deskNumber: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    service: {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    };
    branchId: string;
    steps: {
        queue: {
            name: string;
            prefix: string;
            mode: "new";
        } | {
            queueId: string;
            mode: "existing";
        };
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        deskNumber: string;
    }[];
    flowType: "multi";
    templateName: string;
    autoActivate: boolean;
}, {
    service: {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    };
    branchId: string;
    steps: {
        queue: {
            name: string;
            prefix: string;
            mode: "new";
        } | {
            queueId: string;
            mode: "existing";
        };
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        deskNumber: string;
    }[];
    flowType: "multi";
    templateName: string;
    autoActivate?: boolean | undefined;
}>;
export declare const guidedSetupDeploySchema: z.ZodDiscriminatedUnion<"flowType", [z.ZodObject<{
    flowType: z.ZodLiteral<"single">;
    branchId: z.ZodString;
    service: z.ZodEffects<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"new">;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        durationMinutes: z.ZodNumber;
        serviceEstimateLowMinutes: z.ZodNumber;
        serviceEstimateHighMinutes: z.ZodNumber;
        instructionalTip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    }, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"existing">;
        serviceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        serviceId: string;
        mode: "existing";
    }, {
        serviceId: string;
        mode: "existing";
    }>]>, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    }, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    }>;
    queue: z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"new">;
        name: z.ZodString;
        prefix: z.ZodString;
        callingPolicy: z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        prefix: string;
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        mode: "new";
    }, {
        name: string;
        prefix: string;
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        mode: "new";
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"existing">;
        queueId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        queueId: string;
        mode: "existing";
    }, {
        queueId: string;
        mode: "existing";
    }>]>;
}, "strip", z.ZodTypeAny, {
    service: {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    };
    queue: {
        name: string;
        prefix: string;
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        mode: "new";
    } | {
        queueId: string;
        mode: "existing";
    };
    branchId: string;
    flowType: "single";
}, {
    service: {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    };
    queue: {
        name: string;
        prefix: string;
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        mode: "new";
    } | {
        queueId: string;
        mode: "existing";
    };
    branchId: string;
    flowType: "single";
}>, z.ZodObject<{
    flowType: z.ZodLiteral<"multi">;
    branchId: z.ZodString;
    service: z.ZodEffects<z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
        mode: z.ZodLiteral<"new">;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        durationMinutes: z.ZodNumber;
        serviceEstimateLowMinutes: z.ZodNumber;
        serviceEstimateHighMinutes: z.ZodNumber;
        instructionalTip: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    }, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    }>, z.ZodObject<{
        mode: z.ZodLiteral<"existing">;
        serviceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        serviceId: string;
        mode: "existing";
    }, {
        serviceId: string;
        mode: "existing";
    }>]>, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    }, {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    }>;
    templateName: z.ZodString;
    autoActivate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    steps: z.ZodArray<z.ZodObject<{
        deskNumber: z.ZodString;
        stepRole: z.ZodEnum<["service", "pickup"]>;
        callingPolicy: z.ZodEnum<["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"]>;
        queue: z.ZodDiscriminatedUnion<"mode", [z.ZodObject<{
            mode: z.ZodLiteral<"new">;
            name: z.ZodString;
            prefix: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            prefix: string;
            mode: "new";
        }, {
            name: string;
            prefix: string;
            mode: "new";
        }>, z.ZodObject<{
            mode: z.ZodLiteral<"existing">;
            queueId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            queueId: string;
            mode: "existing";
        }, {
            queueId: string;
            mode: "existing";
        }>]>;
    }, "strip", z.ZodTypeAny, {
        queue: {
            name: string;
            prefix: string;
            mode: "new";
        } | {
            queueId: string;
            mode: "existing";
        };
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        deskNumber: string;
    }, {
        queue: {
            name: string;
            prefix: string;
            mode: "new";
        } | {
            queueId: string;
            mode: "existing";
        };
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        deskNumber: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    service: {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    };
    branchId: string;
    steps: {
        queue: {
            name: string;
            prefix: string;
            mode: "new";
        } | {
            queueId: string;
            mode: "existing";
        };
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        deskNumber: string;
    }[];
    flowType: "multi";
    templateName: string;
    autoActivate: boolean;
}, {
    service: {
        name: string;
        durationMinutes: number;
        serviceEstimateLowMinutes: number;
        serviceEstimateHighMinutes: number;
        mode: "new";
        description?: string | undefined;
        instructionalTip?: string | null | undefined;
    } | {
        serviceId: string;
        mode: "existing";
    };
    branchId: string;
    steps: {
        queue: {
            name: string;
            prefix: string;
            mode: "new";
        } | {
            queueId: string;
            mode: "existing";
        };
        stepRole: "service" | "pickup";
        callingPolicy: "fifo" | "manual_only" | "ready_then_manual" | "ready_then_fifo";
        deskNumber: string;
    }[];
    flowType: "multi";
    templateName: string;
    autoActivate?: boolean | undefined;
}>]>;
export type GuidedSetupDeployInput = z.infer<typeof guidedSetupDeploySchema>;
/** Client-side / shared validation for multi-step guided builder drafts. */
export declare function validateGuidedMultiSteps(steps: Array<{
    mode: 'existing' | 'new';
    selectedQueueId?: string;
    newQueuePrefix?: string;
    deskNumber?: string;
    stepRole?: string;
    callingPolicy?: string;
}>, branchQueues?: Array<{
    prefix?: string | null;
}>): string | null;
export declare function validateGuidedSingleQueuePrefix(prefix: string, branchQueues: Array<{
    prefix?: string | null;
}>, existingPrefixesInDraft?: string[]): string | null;
//# sourceMappingURL=guided-setup.validators.d.ts.map