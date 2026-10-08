"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const loyalty_public_branding_1 = require("./loyalty-public-branding");
(0, vitest_1.describe)('buildLoyaltyPublicBranding', () => {
    (0, vitest_1.it)('falls back programName to orgName and defaults points currency', () => {
        (0, vitest_1.expect)((0, loyalty_public_branding_1.buildLoyaltyPublicBranding)({
            orgName: 'Cafe',
            logoUrl: 'https://cdn.example/logo.png',
            brandPrimaryColor: '#112233',
        })).toEqual({
            orgName: 'Cafe',
            logoUrl: 'https://cdn.example/logo.png',
            primaryColor: '#112233',
            accentColor: null,
            programName: 'Cafe',
            pointsCurrencyName: 'Points',
        });
    });
    (0, vitest_1.it)('uses program display name when provided', () => {
        (0, vitest_1.expect)((0, loyalty_public_branding_1.buildLoyaltyPublicBranding)({
            orgName: 'Cafe LLC',
            programDisplayName: 'Stars Club',
            pointsCurrencyName: 'Stars',
        }).programName).toBe('Stars Club');
    });
});
//# sourceMappingURL=loyalty-public-branding.spec.js.map