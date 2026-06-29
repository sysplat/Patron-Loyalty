#!/usr/bin/env node
/**
 * Verify pl-api Sentry release correlation in production.
 *
 * Usage:
 *   node scripts/verify-sentry-prod.mjs
 *   API_URL=https://pl-api-production-a528.up.railway.app node scripts/verify-sentry-prod.mjs
 */
const apiBase = (
  process.env.API_URL ??
  process.env.LOYALTY_API_URL?.replace(/\/api\/v1\/?$/, '') ??
  'https://pl-api-production-a528.up.railway.app'
).replace(/\/$/, '');

async function main() {
  const res = await fetch(`${apiBase}/api/v1/health/meta`);
  if (!res.ok) {
    console.error(`health/meta failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const meta = await res.json();
  const release = String(meta.release ?? '');
  const sentryEnabled = meta.sentryEnabled === true;

  console.log(JSON.stringify({ release, sentryEnabled, environment: meta.environment }, null, 2));

  if (!release || release === 'development') {
    console.error('Release is not set to a deploy SHA — set SENTRY_RELEASE on pl-api.');
    process.exit(1);
  }

  if (!sentryEnabled) {
    console.error(
      'sentryEnabled is false — set SENTRY_DSN on pl-api (Railway UI) and redeploy. See docs/operations/QLESSQ_CONNECTOR_OPS.md',
    );
    process.exit(1);
  }

  console.log('Sentry prod correlation OK.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
