/** Which product surfaces this API process registers at boot. */
export declare const API_DEPLOY_PROFILES: {
    readonly FULL: "full";
    readonly LOYALTY: "loyalty";
};
export type ApiDeployProfile = (typeof API_DEPLOY_PROFILES)[keyof typeof API_DEPLOY_PROFILES];
export declare const API_DEPLOY_PROFILE_VALUES: [ApiDeployProfile, ...ApiDeployProfile[]];
export declare function resolveApiDeployProfile(raw?: string | null | undefined): ApiDeployProfile;
export declare function isLoyaltyOnlyApiDeploy(profile: ApiDeployProfile): boolean;
//# sourceMappingURL=api-deploy-profile.d.ts.map