import { describe, it, expect } from 'vitest';
import {
  JOURNEY_FINAL_STEP_COMPLETE_TOAST,
  JOURNEY_STEP_ADVANCED_TOAST,
  shouldShowJourneyCompleteSuccessToast,
} from './journey-complete-toast';

describe('journey-complete-toast', () => {
  it('suppresses success toast when a next journey step exists', () => {
    expect(shouldShowJourneyCompleteSuccessToast('queue-lab')).toBe(false);
  });

  it('shows success toast on the final step (no next queue)', () => {
    expect(shouldShowJourneyCompleteSuccessToast(null)).toBe(true);
  });

  it('uses a short final-step message', () => {
    expect(JOURNEY_FINAL_STEP_COMPLETE_TOAST).toBe('Visit complete');
    expect(JOURNEY_FINAL_STEP_COMPLETE_TOAST.toLowerCase()).not.toContain('advanced');
  });

  it('uses a mid-step advance message', () => {
    expect(JOURNEY_STEP_ADVANCED_TOAST.toLowerCase()).toContain('next step');
  });
});
