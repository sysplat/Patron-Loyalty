import { describe, expect, it } from 'vitest';
import {
  validateGuidedMultiSteps,
  validateGuidedSingleQueuePrefix,
} from './guided-setup.validators';

describe('guided-setup validators', () => {
  it('rejects duplicate prefixes within a multi-step draft', () => {
    const error = validateGuidedMultiSteps([
      {
        mode: 'new',
        newQueuePrefix: 'A',
        deskNumber: '1',
        stepRole: 'service',
        callingPolicy: 'fifo',
      },
      {
        mode: 'new',
        newQueuePrefix: 'A',
        deskNumber: '2',
        stepRole: 'pickup',
        callingPolicy: 'ready_then_manual',
      },
    ]);
    expect(error).toMatch(/prefix "A"/i);
  });

  it('rejects duplicate queue ids across steps', () => {
    const error = validateGuidedMultiSteps([
      {
        mode: 'existing',
        selectedQueueId: 'queue-1',
        deskNumber: '1',
        stepRole: 'service',
        callingPolicy: 'fifo',
      },
      {
        mode: 'existing',
        selectedQueueId: 'queue-1',
        deskNumber: '2',
        stepRole: 'pickup',
        callingPolicy: 'ready_then_manual',
      },
    ]);
    expect(error).toMatch(/same queue/i);
  });

  it('rejects duplicate desk numbers across steps', () => {
    const error = validateGuidedMultiSteps([
      {
        mode: 'new',
        newQueuePrefix: 'A',
        deskNumber: '1',
        stepRole: 'service',
        callingPolicy: 'fifo',
      },
      {
        mode: 'new',
        newQueuePrefix: 'B',
        deskNumber: '1',
        stepRole: 'pickup',
        callingPolicy: 'ready_then_manual',
      },
    ]);
    expect(error).toMatch(/different serving desk/i);
  });

  it('detects branch prefix collisions for single-step queues', () => {
    const error = validateGuidedSingleQueuePrefix('G', [{ prefix: 'G' }]);
    expect(error).toMatch(/already used/i);
  });

  it('detects branch prefix collisions for multi-step new queues', () => {
    const error = validateGuidedMultiSteps(
      [
        {
          mode: 'new',
          newQueuePrefix: 'G',
          deskNumber: '1',
          stepRole: 'service',
          callingPolicy: 'fifo',
        },
        {
          mode: 'new',
          newQueuePrefix: 'H',
          deskNumber: '2',
          stepRole: 'pickup',
          callingPolicy: 'ready_then_manual',
        },
      ],
      [{ prefix: 'G' }],
    );
    expect(error).toMatch(/Step 1:.*already used/i);
  });
});
