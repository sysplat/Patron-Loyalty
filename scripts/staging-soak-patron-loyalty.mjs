#!/usr/bin/env node
/**
 * Staging / prod boundary smoke for Patron Loyalty API (no GitHub Actions minutes).
 *
 * Usage:
 *   node scripts/staging-soak-patron-loyalty.mjs
 *   API_URL=https://pl-api-production-a528.up.railway.app node scripts/staging-soak-patron-loyalty.mjs
 */
const apiBase = (process.env.API_URL ?? 'https://pl-api-production-a528.up.railway.app').replace(
  /\/$/,
  '',
);

async function check(label, fn) {
  try {
    await fn();
    console.log(`✅ ${label}`);
    return true;
  } catch (err) {
    console.error(`❌ ${label}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  console.log(`Patron Loyalty soak → ${apiBase}\n`);
  let ok = true;

  ok &&=
    (await check('health/meta release', async () => {
      const res = await fetch(`${apiBase}/api/v1/health/meta`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const meta = await res.json();
      if (!meta.release || meta.release === 'development') {
        throw new Error('release not set to deploy SHA');
      }
    })) ?? false;

  ok &&=
    (await check('health 200', async () => {
      const res = await fetch(`${apiBase}/api/v1/health`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    })) ?? false;

  ok &&=
    (await check('QMS tickets 404 (loyalty boundary)', async () => {
      const res = await fetch(`${apiBase}/api/v1/tickets`);
      if (res.status !== 404) throw new Error(`HTTP ${res.status}`);
    })) ?? false;

  ok &&=
    (await check('QMS queues 404 (loyalty boundary)', async () => {
      const res = await fetch(`${apiBase}/api/v1/queues`);
      if (res.status !== 404) throw new Error(`HTTP ${res.status}`);
    })) ?? false;

  ok &&=
    (await check('queue-events 401 without API key', async () => {
      const res = await fetch(`${apiBase}/api/v1/loyalty/integrations/v1/queue-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.status !== 401) throw new Error(`HTTP ${res.status}`);
    })) ?? false;

  const sentryRes = await fetch(`${apiBase}/api/v1/health/meta`).then((r) => r.json());
  if (sentryRes.sentryEnabled !== true) {
    console.warn('⚠️  sentryEnabled is false — set SENTRY_DSN on pl-api (Phase 5)');
  } else {
    console.log('✅ sentryEnabled');
  }

  console.log(ok ? '\nSoak passed.' : '\nSoak failed.');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
