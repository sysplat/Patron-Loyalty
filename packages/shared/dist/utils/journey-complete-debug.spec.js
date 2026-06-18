"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const journey_complete_debug_1 = require("./journey-complete-debug");
(0, vitest_1.describe)('journey-complete-debug', () => {
    (0, vitest_1.it)('recognizes journey complete error codes', () => {
        (0, vitest_1.expect)((0, journey_complete_debug_1.isJourneyCompleteErrorCode)(journey_complete_debug_1.JOURNEY_COMPLETE_ERROR_CODES.NEXT_QUEUE_NOT_FOUND)).toBe(true);
        (0, vitest_1.expect)((0, journey_complete_debug_1.isJourneyCompleteErrorCode)('TICKET_INVALID_TRANSITION')).toBe(false);
    });
    (0, vitest_1.it)('builds structured error payloads', () => {
        const payload = (0, journey_complete_debug_1.buildJourneyCompleteErrorPayload)(journey_complete_debug_1.JOURNEY_COMPLETE_ERROR_CODES.ISSUE_NEXT_FAILED, 'Could not issue next step', {
            ticketId: 't-1',
            reason: 'Queue not found',
            failureKind: 'queue_not_found',
            currentQueueId: 'q-1',
            nextQueueId: 'q-2',
        });
        (0, vitest_1.expect)(payload.code).toBe('JOURNEY_ISSUE_NEXT_FAILED');
        (0, vitest_1.expect)(payload.details.failureKind).toBe('queue_not_found');
    });
    (0, vitest_1.it)('fingerprints repeated failures consistently', () => {
        const details = {
            failureKind: 'queue_not_found',
            currentQueueId: 'q-reception',
            nextQueueId: 'q-lab-stale',
        };
        (0, vitest_1.expect)((0, journey_complete_debug_1.journeyCompleteErrorFingerprint)(journey_complete_debug_1.JOURNEY_COMPLETE_ERROR_CODES.ISSUE_NEXT_FAILED, details)).toEqual([
            'journey-complete-failure',
            'JOURNEY_ISSUE_NEXT_FAILED',
            'queue_not_found',
            'q-reception',
            'q-lab-stale',
        ]);
    });
});
//# sourceMappingURL=journey-complete-debug.spec.js.map