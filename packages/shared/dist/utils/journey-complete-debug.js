"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOURNEY_COMPLETE_FAILURE_LOG_PREFIX = exports.JOURNEY_COMPLETE_ERROR_CODES = void 0;
exports.isJourneyCompleteErrorCode = isJourneyCompleteErrorCode;
exports.buildJourneyCompleteErrorPayload = buildJourneyCompleteErrorPayload;
exports.journeyCompleteErrorFingerprint = journeyCompleteErrorFingerprint;
/** Stable API error codes for multi-step journey complete / advance failures. */
exports.JOURNEY_COMPLETE_ERROR_CODES = {
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
};
function isJourneyCompleteErrorCode(code) {
    if (!code)
        return false;
    return Object.values(exports.JOURNEY_COMPLETE_ERROR_CODES).includes(code);
}
function buildJourneyCompleteErrorPayload(code, message, details) {
    return { code, message, details };
}
/** Groups repeated journey-complete failures in Sentry and log queries. */
function journeyCompleteErrorFingerprint(code, details) {
    return [
        'journey-complete-failure',
        code,
        details?.failureKind ?? 'unknown',
        details?.currentQueueId ?? 'no-current-queue',
        details?.nextQueueId ?? 'no-next-queue',
    ];
}
exports.JOURNEY_COMPLETE_FAILURE_LOG_PREFIX = '[JOURNEY_COMPLETE_FAILED]';
//# sourceMappingURL=journey-complete-debug.js.map