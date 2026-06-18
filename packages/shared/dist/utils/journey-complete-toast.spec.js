"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const journey_complete_toast_1 = require("./journey-complete-toast");
(0, vitest_1.describe)('journey-complete-toast', () => {
    (0, vitest_1.it)('suppresses success toast when a next journey step exists', () => {
        (0, vitest_1.expect)((0, journey_complete_toast_1.shouldShowJourneyCompleteSuccessToast)('queue-lab')).toBe(false);
    });
    (0, vitest_1.it)('shows success toast on the final step (no next queue)', () => {
        (0, vitest_1.expect)((0, journey_complete_toast_1.shouldShowJourneyCompleteSuccessToast)(null)).toBe(true);
    });
    (0, vitest_1.it)('uses a short final-step message', () => {
        (0, vitest_1.expect)(journey_complete_toast_1.JOURNEY_FINAL_STEP_COMPLETE_TOAST).toBe('Visit complete');
        (0, vitest_1.expect)(journey_complete_toast_1.JOURNEY_FINAL_STEP_COMPLETE_TOAST.toLowerCase()).not.toContain('advanced');
    });
    (0, vitest_1.it)('uses a mid-step advance message', () => {
        (0, vitest_1.expect)(journey_complete_toast_1.JOURNEY_STEP_ADVANCED_TOAST.toLowerCase()).toContain('next step');
    });
});
//# sourceMappingURL=journey-complete-toast.spec.js.map