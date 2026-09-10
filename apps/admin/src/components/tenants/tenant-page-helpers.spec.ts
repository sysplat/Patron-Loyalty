import { describe, expect, it } from 'vitest';
import {
  formatOnboardingStep,
  formatProductSku,
  formatTenantPlanLabel,
  formatTenantPlanSlug,
  isProtectedPlatformOrg,
  SETUP_MODE_PLAN_LABEL,
} from './tenant-page-helpers';

describe('tenant detail helpers', () => {
  it('labels setup mode when there is no active plan', () => {
    expect(formatTenantPlanLabel(undefined)).toBe(SETUP_MODE_PLAN_LABEL);
    expect(formatTenantPlanLabel({ plan: null })).toBe(SETUP_MODE_PLAN_LABEL);
    expect(formatTenantPlanSlug(undefined)).toBe('');
  });

  it('returns the real plan name and slug when present', () => {
    expect(formatTenantPlanLabel({ plan: { name: 'Starter' } })).toBe('Starter');
    expect(formatTenantPlanSlug({ plan: { slug: 'starter' } })).toBe('starter');
  });

  it('humanizes onboarding steps', () => {
    expect(formatOnboardingStep('service_selection')).toBe('Service selection');
    expect(formatOnboardingStep('completed')).toBe('Completed');
  });

  it('labels product SKUs', () => {
    expect(formatProductSku('qms')).toBe('Queue (QMS)');
    expect(formatProductSku('bundle')).toBe('Queue + Loyalty');
  });

  it('protects the internal platform org', () => {
    expect(isProtectedPlatformOrg('queueplatform-internal')).toBe(true);
    expect(isProtectedPlatformOrg('dsdfdks-0c0a3b')).toBe(false);
  });
});
