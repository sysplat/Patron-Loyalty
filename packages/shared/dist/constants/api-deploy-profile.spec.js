"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const api_deploy_profile_1 = require("./api-deploy-profile");
const queue_product_api_1 = require("./queue-product-api");
(0, vitest_1.describe)('resolveApiDeployProfile', () => {
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.unstubAllEnvs();
    });
    (0, vitest_1.it)('defaults to full when unset', () => {
        vitest_1.vi.stubEnv('API_DEPLOY_PROFILE', '');
        (0, vitest_1.expect)((0, api_deploy_profile_1.resolveApiDeployProfile)()).toBe(api_deploy_profile_1.API_DEPLOY_PROFILES.FULL);
    });
    (0, vitest_1.it)('returns loyalty for loyalty profile', () => {
        vitest_1.vi.stubEnv('API_DEPLOY_PROFILE', 'loyalty');
        (0, vitest_1.expect)((0, api_deploy_profile_1.resolveApiDeployProfile)()).toBe(api_deploy_profile_1.API_DEPLOY_PROFILES.LOYALTY);
    });
});
(0, vitest_1.describe)('isQueueProductApiPath', () => {
    (0, vitest_1.it)('matches QMS route prefixes', () => {
        (0, vitest_1.expect)((0, queue_product_api_1.isQueueProductApiPath)('/api/v1/tickets/abc')).toBe(true);
        (0, vitest_1.expect)((0, queue_product_api_1.isQueueProductApiPath)('/api/v1/queues')).toBe(true);
        (0, vitest_1.expect)((0, queue_product_api_1.isQueueProductApiPath)('/api/v1/loyalty/patrons')).toBe(false);
    });
});
//# sourceMappingURL=api-deploy-profile.spec.js.map