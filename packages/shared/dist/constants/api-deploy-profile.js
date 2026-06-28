"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_DEPLOY_PROFILE_VALUES = exports.API_DEPLOY_PROFILES = void 0;
exports.resolveApiDeployProfile = resolveApiDeployProfile;
exports.isLoyaltyOnlyApiDeploy = isLoyaltyOnlyApiDeploy;
/** Which product surfaces this API process registers at boot. */
exports.API_DEPLOY_PROFILES = {
    FULL: 'full',
    LOYALTY: 'loyalty',
};
exports.API_DEPLOY_PROFILE_VALUES = Object.values(exports.API_DEPLOY_PROFILES);
function resolveApiDeployProfile(raw = process.env.API_DEPLOY_PROFILE) {
    const normalized = raw?.trim().toLowerCase();
    if (normalized === exports.API_DEPLOY_PROFILES.LOYALTY) {
        return exports.API_DEPLOY_PROFILES.LOYALTY;
    }
    return exports.API_DEPLOY_PROFILES.FULL;
}
function isLoyaltyOnlyApiDeploy(profile) {
    return profile === exports.API_DEPLOY_PROFILES.LOYALTY;
}
//# sourceMappingURL=api-deploy-profile.js.map