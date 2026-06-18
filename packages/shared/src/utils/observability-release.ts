/** Release identifier for Sentry and health/meta (Railway/Vercel commit SHA when unset). */
export function getObservabilityRelease(): string {
  const fromEnv =
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() ||
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  return fromEnv || 'development';
}
