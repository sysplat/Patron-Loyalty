import { describe, it, expect } from 'vitest';
import { resolveFeatureModulesForProfile } from './app-modules.registry';
import { API_DEPLOY_PROFILES } from '@queueplatform/shared';

describe('resolveFeatureModulesForProfile', () => {
  it('registers fewer modules for loyalty deploy profile', () => {
    const full = resolveFeatureModulesForProfile(API_DEPLOY_PROFILES.FULL);
    const loyalty = resolveFeatureModulesForProfile(API_DEPLOY_PROFILES.LOYALTY);
    expect(loyalty.length).toBeLessThan(full.length);
  });

  it('always includes loyalty module', () => {
    const loyalty = resolveFeatureModulesForProfile(API_DEPLOY_PROFILES.LOYALTY);
    expect(loyalty.some((mod) => mod.name === 'LoyaltyModule')).toBe(true);
  });
});
