"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const impersonation_handoff_1 = require("./impersonation-handoff");
const samplePayload = {
    accessToken: 'jwt-token',
    orgId: 'org-1',
    orgName: 'Demo Org',
    operatorOrgSlug: 'queueplatform-internal',
    role: 'owner',
    roleSimulation: false,
    operator: {
        id: 'user-1',
        email: 'ops@example.com',
        firstName: 'Pat',
        lastName: 'Ops',
    },
};
(0, vitest_1.describe)('impersonation-handoff', () => {
    (0, vitest_1.it)('round-trips payload through base64url encoding', () => {
        const encoded = (0, impersonation_handoff_1.encodeImpersonationHandoff)(samplePayload);
        (0, vitest_1.expect)((0, impersonation_handoff_1.decodeImpersonationHandoff)(encoded)).toEqual(samplePayload);
    });
    (0, vitest_1.it)('builds dashboard URL with hash handoff', () => {
        const url = (0, impersonation_handoff_1.buildImpersonationLaunchUrl)('https://qms-web-production.up.railway.app', '/dashboard', samplePayload);
        (0, vitest_1.expect)(url.startsWith('https://qms-web-production.up.railway.app/dashboard#qp-imp=')).toBe(true);
        const hash = url.slice(url.indexOf('#'));
        (0, vitest_1.expect)((0, impersonation_handoff_1.parseImpersonationHandoffFromHash)(hash)).toEqual(samplePayload);
    });
    (0, vitest_1.it)('maps payload to auth session for tenant apps', () => {
        const session = (0, impersonation_handoff_1.impersonationHandoffToSession)(samplePayload);
        (0, vitest_1.expect)(session.accessToken).toBe('jwt-token');
        (0, vitest_1.expect)(session.user.orgId).toBe('org-1');
        (0, vitest_1.expect)(session.user.orgSlug).toBe('queueplatform-internal');
        (0, vitest_1.expect)(session.user.impersonation).toBe(true);
        (0, vitest_1.expect)(session.user.twoFactorEnabled).toBe(true);
    });
});
//# sourceMappingURL=impersonation-handoff.spec.js.map