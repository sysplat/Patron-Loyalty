"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const tenant_web_url_1 = require("./tenant-web-url");
(0, vitest_1.describe)('resolveTenantWebUrl', () => {
    (0, vitest_1.it)('prefers explicit webUrl', () => {
        (0, vitest_1.expect)((0, tenant_web_url_1.resolveTenantWebUrl)('https://loyalty.example.com/')).toBe('https://loyalty.example.com');
    });
    (0, vitest_1.it)('maps production loyalty admin host when env is missing', () => {
        (0, vitest_1.expect)((0, tenant_web_url_1.resolveTenantWebUrl)(undefined, 'loyalty-admin.sysplat.com')).toBe('https://loyalty.sysplat.com');
    });
    (0, vitest_1.it)('falls back to localhost loyalty port for unknown hosts', () => {
        (0, vitest_1.expect)((0, tenant_web_url_1.resolveTenantWebUrl)(undefined, 'unknown.example')).toBe('http://localhost:3003');
    });
});
//# sourceMappingURL=tenant-web-url.spec.js.map