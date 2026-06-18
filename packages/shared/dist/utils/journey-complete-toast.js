"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOURNEY_STEP_ADVANCED_TOAST = exports.JOURNEY_FINAL_STEP_COMPLETE_TOAST = void 0;
exports.shouldShowJourneyCompleteSuccessToast = shouldShowJourneyCompleteSuccessToast;
/** Shown only when completing the final step (no next queue in the journey). */
exports.JOURNEY_FINAL_STEP_COMPLETE_TOAST = 'Visit complete';
/** Shown when a visit advances to the next journey step. */
exports.JOURNEY_STEP_ADVANCED_TOAST = 'Customer advanced to the next step — switch to that step to continue.';
/**
 * Mid-step completes use optimistic board UI (incoming row + waiting count); no Sonner success.
 * Final step has no next lane cue, so a short success toast is appropriate.
 */
function shouldShowJourneyCompleteSuccessToast(nextQueueId) {
    return nextQueueId == null;
}
//# sourceMappingURL=journey-complete-toast.js.map