/** Which product surfaces this API process registers at boot. */
export const API_DEPLOY_PROFILES = {
  FULL: 'full',
  LOYALTY: 'loyalty',
} as const;

export type ApiDeployProfile = (typeof API_DEPLOY_PROFILES)[keyof typeof API_DEPLOY_PROFILES];

export const API_DEPLOY_PROFILE_VALUES = Object.values(API_DEPLOY_PROFILES) as [
  ApiDeployProfile,
  ...ApiDeployProfile[],
];

export function resolveApiDeployProfile(
  raw: string | null | undefined = process.env.API_DEPLOY_PROFILE,
): ApiDeployProfile {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === API_DEPLOY_PROFILES.LOYALTY) {
    return API_DEPLOY_PROFILES.LOYALTY;
  }
  return API_DEPLOY_PROFILES.FULL;
}

export function isLoyaltyOnlyApiDeploy(profile: ApiDeployProfile): boolean {
  return profile === API_DEPLOY_PROFILES.LOYALTY;
}
