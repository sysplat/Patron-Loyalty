import { describe, it, expect } from 'vitest';
import {
  JOURNEY_COMPLETE_ERROR_CODES,
  buildJourneyCompleteErrorPayload,
  isJourneyCompleteErrorCode,
  journeyCompleteErrorFingerprint,
} from './journey-complete-debug';

describe('journey-complete-debug', () => {
  it('recognizes journey complete error codes', () => {
    expect(isJourneyCompleteErrorCode(JOURNEY_COMPLETE_ERROR_CODES.NEXT_QUEUE_NOT_FOUND)).toBe(
      true,
    );
    expect(isJourneyCompleteErrorCode('TICKET_INVALID_TRANSITION')).toBe(false);
  });

  it('builds structured error payloads', () => {
    const payload = buildJourneyCompleteErrorPayload(
      JOURNEY_COMPLETE_ERROR_CODES.ISSUE_NEXT_FAILED,
      'Could not issue next step',
      {
        ticketId: 't-1',
        reason: 'Queue not found',
        failureKind: 'queue_not_found',
        currentQueueId: 'q-1',
        nextQueueId: 'q-2',
      },
    );
    expect(payload.code).toBe('JOURNEY_ISSUE_NEXT_FAILED');
    expect(payload.details.failureKind).toBe('queue_not_found');
  });

  it('fingerprints repeated failures consistently', () => {
    const details = {
      failureKind: 'queue_not_found',
      currentQueueId: 'q-reception',
      nextQueueId: 'q-lab-stale',
    };
    expect(
      journeyCompleteErrorFingerprint(JOURNEY_COMPLETE_ERROR_CODES.ISSUE_NEXT_FAILED, details),
    ).toEqual([
      'journey-complete-failure',
      'JOURNEY_ISSUE_NEXT_FAILED',
      'queue_not_found',
      'q-reception',
      'q-lab-stale',
    ]);
  });
});
