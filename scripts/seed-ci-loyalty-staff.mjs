#!/usr/bin/env node
/**
 * Seed a staff user for CI / local Playwright smoke (idempotent).
 *
 * Usage:
 *   API_BASE_URL=http://localhost:4000 node scripts/seed-ci-loyalty-staff.mjs
 */
const apiBase = (process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const email =
  process.env.LOYALTY_SMOKE_EMAIL ?? 'ci-loyalty-staff@queueplatform.test';
const password = process.env.LOYALTY_SMOKE_PASSWORD ?? 'CiLoyalty1!';

async function main() {
  const res = await fetch(`${apiBase}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationName: 'CI Loyalty Org',
      firstName: 'CI',
      lastName: 'Staff',
      email,
      password,
      acceptLegal: true,
    }),
  });

  if (res.ok) {
    console.log(`Registered CI loyalty staff: ${email}`);
    return;
  }

  if (res.status === 409) {
    console.log(`CI loyalty staff already exists: ${email}`);
    return;
  }

  const body = await res.text();
  console.error(`Register failed: HTTP ${res.status} ${body.slice(0, 300)}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
