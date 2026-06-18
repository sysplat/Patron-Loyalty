"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const guided_setup_validators_1 = require("./guided-setup.validators");
(0, vitest_1.describe)('guided-setup validators', () => {
    (0, vitest_1.it)('rejects duplicate prefixes within a multi-step draft', () => {
        const error = (0, guided_setup_validators_1.validateGuidedMultiSteps)([
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
        (0, vitest_1.expect)(error).toMatch(/prefix "A"/i);
    });
    (0, vitest_1.it)('rejects duplicate queue ids across steps', () => {
        const error = (0, guided_setup_validators_1.validateGuidedMultiSteps)([
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
        (0, vitest_1.expect)(error).toMatch(/same queue/i);
    });
    (0, vitest_1.it)('rejects duplicate desk numbers across steps', () => {
        const error = (0, guided_setup_validators_1.validateGuidedMultiSteps)([
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
        (0, vitest_1.expect)(error).toMatch(/different serving desk/i);
    });
    (0, vitest_1.it)('detects branch prefix collisions for single-step queues', () => {
        const error = (0, guided_setup_validators_1.validateGuidedSingleQueuePrefix)('G', [{ prefix: 'G' }]);
        (0, vitest_1.expect)(error).toMatch(/already used/i);
    });
    (0, vitest_1.it)('detects branch prefix collisions for multi-step new queues', () => {
        const error = (0, guided_setup_validators_1.validateGuidedMultiSteps)([
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
        ], [{ prefix: 'G' }]);
        (0, vitest_1.expect)(error).toMatch(/Step 1:.*already used/i);
    });
});
//# sourceMappingURL=guided-setup.validators.spec.js.map