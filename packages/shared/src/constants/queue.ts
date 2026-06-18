export const QUEUE_STEP_ROLES = ['service', 'pickup'] as const;
export type QueueStepRole = (typeof QUEUE_STEP_ROLES)[number];

export const QUEUE_CALLING_POLICIES = [
  'fifo',
  'manual_only',
  'ready_then_manual',
  'ready_then_fifo',
] as const;
export type QueueCallingPolicy = (typeof QUEUE_CALLING_POLICIES)[number];

/** Coerce unknown values to a supported calling policy (defaults to fifo). */
export function normalizeCallingPolicyValue(policy?: string | null): QueueCallingPolicy {
  if (policy === 'manual_only' || policy === 'ready_then_manual' || policy === 'ready_then_fifo') {
    return policy;
  }
  return 'fifo';
}

/**
 * Effective calling policy for a queue step, including pickup-desk coercion rules.
 * Use for flow steps, queue records, and runtime ticket operations.
 */
export function resolveCallingPolicyForStep(
  stepRole?: string | null,
  callingPolicy?: string | null,
): QueueCallingPolicy {
  const policy = normalizeCallingPolicyValue(callingPolicy);
  if (stepRole === 'pickup') {
    if (policy === 'fifo' || policy === 'manual_only') {
      return 'ready_then_manual';
    }
  }
  return policy;
}

/** Only queues explicitly set to multi-step can appear in branch flow templates. */
export function isFlowEligibleQueue(journeyModeOverride?: string | null): boolean {
  return journeyModeOverride === 'visit_multi_step';
}

/** Queues where agents pick who to call from the waiting list (row Call), not Call Next. */
export function queueUsesManualRowCall(policy?: string | null): boolean {
  const normalized = normalizeCallingPolicyValue(policy);
  return normalized === 'manual_only' || normalized === 'ready_then_manual';
}

/** Whether a waiting ticket may be called via row-level Call (policy + readiness). */
export function canManuallyCallWaitingTicket(
  policy?: string | null,
  readyAt?: Date | string | null,
): boolean {
  const normalized = normalizeCallingPolicyValue(policy);
  if (!queueUsesManualRowCall(normalized)) return false;
  if (normalized === 'ready_then_manual' && !readyAt) return false;
  return true;
}
