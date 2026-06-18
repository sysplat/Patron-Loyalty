/** Stable API error codes for multi-step journey complete / advance failures. */
export const JOURNEY_COMPLETE_ERROR_CODES = {
  NOT_CONFIGURED: 'JOURNEY_NOT_CONFIGURED',
  NEXT_QUEUE_NOT_FOUND: 'JOURNEY_NEXT_QUEUE_NOT_FOUND',
  NEXT_QUEUE_CLOSED: 'JOURNEY_NEXT_QUEUE_CLOSED',
  NEXT_QUEUE_BRANCH_MISMATCH: 'JOURNEY_NEXT_QUEUE_BRANCH_MISMATCH',
  EXTERNAL_REF_REQUIRED: 'JOURNEY_EXTERNAL_REF_REQUIRED',
  ISSUE_NEXT_FAILED: 'JOURNEY_ISSUE_NEXT_FAILED',
  QUEUE_NOT_FOUND: 'JOURNEY_QUEUE_NOT_FOUND',
  /**
   * A later step is configured for this journey but the next step could not be resolved at
   * commit time (e.g. transient DB/connection degradation). We refuse to silently complete
   * and close the visit; the step stays active so the agent can retry.
   */
  ADVANCE_RESOLUTION_FAILED: 'JOURNEY_ADVANCE_RESOLUTION_FAILED',
} as const;

export type JourneyCompleteErrorCode =
  (typeof JOURNEY_COMPLETE_ERROR_CODES)[keyof typeof JOURNEY_COMPLETE_ERROR_CODES];

/** Structured context returned to clients and attached to observability events. */
export type JourneyCompleteFailureDetails = {
  ticketId: string;
  visitId?: string | null;
  branchId?: string;
  currentStepIndex?: number | null;
  currentQueueId?: string;
  nextStepIndex?: number | null;
  nextQueueId?: string | null;
  nextServiceId?: string | null;
  flowTemplateId?: string | null;
  /** Human-readable summary for logs and support. */
  reason: string;
  /** Stable sub-key for grouping repeated failures in Sentry. */
  failureKind: string;
  queueRepaired?: boolean;
  requestedQueueId?: string | null;
  resolvedQueueId?: string | null;
};

export function isJourneyCompleteErrorCode(
  code: string | undefined,
): code is JourneyCompleteErrorCode {
  if (!code) return false;
  return (Object.values(JOURNEY_COMPLETE_ERROR_CODES) as string[]).includes(code);
}

export function buildJourneyCompleteErrorPayload(
  code: JourneyCompleteErrorCode,
  message: string,
  details: JourneyCompleteFailureDetails,
): { code: JourneyCompleteErrorCode; message: string; details: JourneyCompleteFailureDetails } {
  return { code, message, details };
}

/** Groups repeated journey-complete failures in Sentry and log queries. */
export function journeyCompleteErrorFingerprint(
  code: string,
  details?: Partial<
    Pick<JourneyCompleteFailureDetails, 'failureKind' | 'currentQueueId' | 'nextQueueId'>
  >,
): string[] {
  return [
    'journey-complete-failure',
    code,
    details?.failureKind ?? 'unknown',
    details?.currentQueueId ?? 'no-current-queue',
    details?.nextQueueId ?? 'no-next-queue',
  ];
}

export const JOURNEY_COMPLETE_FAILURE_LOG_PREFIX = '[JOURNEY_COMPLETE_FAILED]';
