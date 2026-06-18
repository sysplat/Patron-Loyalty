export declare const QUEUE_STEP_ROLES: readonly ["service", "pickup"];
export type QueueStepRole = (typeof QUEUE_STEP_ROLES)[number];
export declare const QUEUE_CALLING_POLICIES: readonly ["fifo", "manual_only", "ready_then_manual", "ready_then_fifo"];
export type QueueCallingPolicy = (typeof QUEUE_CALLING_POLICIES)[number];
/** Coerce unknown values to a supported calling policy (defaults to fifo). */
export declare function normalizeCallingPolicyValue(policy?: string | null): QueueCallingPolicy;
/**
 * Effective calling policy for a queue step, including pickup-desk coercion rules.
 * Use for flow steps, queue records, and runtime ticket operations.
 */
export declare function resolveCallingPolicyForStep(stepRole?: string | null, callingPolicy?: string | null): QueueCallingPolicy;
/** Only queues explicitly set to multi-step can appear in branch flow templates. */
export declare function isFlowEligibleQueue(journeyModeOverride?: string | null): boolean;
/** Queues where agents pick who to call from the waiting list (row Call), not Call Next. */
export declare function queueUsesManualRowCall(policy?: string | null): boolean;
/** Whether a waiting ticket may be called via row-level Call (policy + readiness). */
export declare function canManuallyCallWaitingTicket(policy?: string | null, readyAt?: Date | string | null): boolean;
//# sourceMappingURL=queue.d.ts.map