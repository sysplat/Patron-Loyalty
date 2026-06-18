"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const observability_release_1 = require("./observability-release");
const RELEASE_ENV_KEYS = [
    'SENTRY_RELEASE',
    'NEXT_PUBLIC_SENTRY_RELEASE',
    'RAILWAY_GIT_COMMIT_SHA',
    'VERCEL_GIT_COMMIT_SHA',
];
(0, vitest_1.describe)('getObservabilityRelease', () => {
    const saved = {};
    (0, vitest_1.beforeEach)(() => {
        for (const key of RELEASE_ENV_KEYS) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
    });
    (0, vitest_1.afterEach)(() => {
        for (const key of RELEASE_ENV_KEYS) {
            if (saved[key] === undefined)
                delete process.env[key];
            else
                process.env[key] = saved[key];
        }
    });
    (0, vitest_1.it)('falls back to "development" when no release env var is set', () => {
        (0, vitest_1.expect)((0, observability_release_1.getObservabilityRelease)()).toBe('development');
    });
    (0, vitest_1.it)('prefers SENTRY_RELEASE above all other sources', () => {
        process.env.SENTRY_RELEASE = 'sentry-rel';
        process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-sha';
        (0, vitest_1.expect)((0, observability_release_1.getObservabilityRelease)()).toBe('sentry-rel');
    });
    (0, vitest_1.it)('uses platform commit SHAs when explicit release is absent', () => {
        process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-sha';
        (0, vitest_1.expect)((0, observability_release_1.getObservabilityRelease)()).toBe('railway-sha');
        delete process.env.RAILWAY_GIT_COMMIT_SHA;
        process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-sha';
        (0, vitest_1.expect)((0, observability_release_1.getObservabilityRelease)()).toBe('vercel-sha');
    });
    (0, vitest_1.it)('ignores whitespace-only values', () => {
        process.env.SENTRY_RELEASE = '   ';
        process.env.NEXT_PUBLIC_SENTRY_RELEASE = 'public-rel';
        (0, vitest_1.expect)((0, observability_release_1.getObservabilityRelease)()).toBe('public-rel');
    });
});
//# sourceMappingURL=observability-release.spec.js.map