"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const queue_1 = require("./queue");
(0, vitest_1.describe)('queueUsesManualRowCall', () => {
    (0, vitest_1.it)('is true only for manual calling policies', () => {
        (0, vitest_1.expect)((0, queue_1.queueUsesManualRowCall)('manual_only')).toBe(true);
        (0, vitest_1.expect)((0, queue_1.queueUsesManualRowCall)('ready_then_manual')).toBe(true);
        (0, vitest_1.expect)((0, queue_1.queueUsesManualRowCall)('fifo')).toBe(false);
        (0, vitest_1.expect)((0, queue_1.queueUsesManualRowCall)('ready_then_fifo')).toBe(false);
    });
});
(0, vitest_1.describe)('canManuallyCallWaitingTicket', () => {
    (0, vitest_1.it)('allows manual_only without readyAt', () => {
        (0, vitest_1.expect)((0, queue_1.canManuallyCallWaitingTicket)('manual_only', null)).toBe(true);
    });
    (0, vitest_1.it)('requires readyAt for ready_then_manual', () => {
        (0, vitest_1.expect)((0, queue_1.canManuallyCallWaitingTicket)('ready_then_manual', null)).toBe(false);
        (0, vitest_1.expect)((0, queue_1.canManuallyCallWaitingTicket)('ready_then_manual', '2026-01-01')).toBe(true);
    });
    (0, vitest_1.it)('rejects call-next-only policies', () => {
        (0, vitest_1.expect)((0, queue_1.canManuallyCallWaitingTicket)('fifo', null)).toBe(false);
        (0, vitest_1.expect)((0, queue_1.canManuallyCallWaitingTicket)('ready_then_fifo', '2026-01-01')).toBe(false);
    });
});
//# sourceMappingURL=queue.spec.js.map