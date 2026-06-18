"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const frontend_1 = require("./frontend");
(0, vitest_1.describe)('display session cookie constants', () => {
    (0, vitest_1.it)('defines separate long-lived credential and short-lived session cookies', () => {
        (0, vitest_1.expect)(frontend_1.DISPLAY_DEVICE_COOKIE).toBe('qp-display-device');
        (0, vitest_1.expect)(frontend_1.DISPLAY_API_KEY_COOKIE).toBe('qp-display-api-key');
        (0, vitest_1.expect)(frontend_1.DISPLAY_SESSION_COOKIE).toBe('qp-display-session');
    });
    (0, vitest_1.it)('uses long credential TTL and shorter session JWT cookie TTL', () => {
        (0, vitest_1.expect)(frontend_1.DISPLAY_CREDENTIAL_TTL_SECONDS).toBeGreaterThan(frontend_1.DISPLAY_SESSION_TTL_SECONDS);
        (0, vitest_1.expect)(frontend_1.DISPLAY_CREDENTIAL_TTL_SECONDS).toBe(60 * 60 * 24 * 365);
        (0, vitest_1.expect)(frontend_1.DISPLAY_SESSION_TTL_SECONDS).toBe(60 * 60 * 24);
    });
});
//# sourceMappingURL=display-session.spec.js.map