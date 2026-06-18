"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_CALLING_POLICIES = exports.QUEUE_STEP_ROLES = void 0;
exports.normalizeCallingPolicyValue = normalizeCallingPolicyValue;
exports.resolveCallingPolicyForStep = resolveCallingPolicyForStep;
exports.isFlowEligibleQueue = isFlowEligibleQueue;
exports.queueUsesManualRowCall = queueUsesManualRowCall;
exports.canManuallyCallWaitingTicket = canManuallyCallWaitingTicket;
exports.QUEUE_STEP_ROLES = ['service', 'pickup'];
exports.QUEUE_CALLING_POLICIES = [
    'fifo',
    'manual_only',
    'ready_then_manual',
    'ready_then_fifo',
];
/** Coerce unknown values to a supported calling policy (defaults to fifo). */
function normalizeCallingPolicyValue(policy) {
    if (policy === 'manual_only' || policy === 'ready_then_manual' || policy === 'ready_then_fifo') {
        return policy;
    }
    return 'fifo';
}
/**
 * Effective calling policy for a queue step, including pickup-desk coercion rules.
 * Use for flow steps, queue records, and runtime ticket operations.
 */
function resolveCallingPolicyForStep(stepRole, callingPolicy) {
    const policy = normalizeCallingPolicyValue(callingPolicy);
    if (stepRole === 'pickup') {
        if (policy === 'fifo' || policy === 'manual_only') {
            return 'ready_then_manual';
        }
    }
    return policy;
}
/** Only queues explicitly set to multi-step can appear in branch flow templates. */
function isFlowEligibleQueue(journeyModeOverride) {
    return journeyModeOverride === 'visit_multi_step';
}
/** Queues where agents pick who to call from the waiting list (row Call), not Call Next. */
function queueUsesManualRowCall(policy) {
    const normalized = normalizeCallingPolicyValue(policy);
    return normalized === 'manual_only' || normalized === 'ready_then_manual';
}
/** Whether a waiting ticket may be called via row-level Call (policy + readiness). */
function canManuallyCallWaitingTicket(policy, readyAt) {
    const normalized = normalizeCallingPolicyValue(policy);
    if (!queueUsesManualRowCall(normalized))
        return false;
    if (normalized === 'ready_then_manual' && !readyAt)
        return false;
    return true;
}
//# sourceMappingURL=queue.js.map