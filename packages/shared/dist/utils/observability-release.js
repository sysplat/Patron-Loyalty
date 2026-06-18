"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getObservabilityRelease = getObservabilityRelease;
/** Release identifier for Sentry and health/meta (Railway/Vercel commit SHA when unset). */
function getObservabilityRelease() {
    const fromEnv = process.env.SENTRY_RELEASE?.trim() ||
        process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() ||
        process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
        process.env.VERCEL_GIT_COMMIT_SHA?.trim();
    return fromEnv || 'development';
}
//# sourceMappingURL=observability-release.js.map