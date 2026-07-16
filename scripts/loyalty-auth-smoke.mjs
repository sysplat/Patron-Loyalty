#!/usr/bin/env node
/**
 * Smoke-test loyalty auth BFF on a deployed instance.
 *
 * Usage:
 *   LOYALTY_URL=https://pl-loyalty-production.up.railway.app node scripts/loyalty-auth-smoke.mjs
 *   LOYALTY_SMOKE_EMAIL=... LOYALTY_SMOKE_PASSWORD=... node scripts/loyalty-auth-smoke.mjs
 *   pnpm audit:loyalty-auth-smoke   # loads .env / .env.local when present
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));

const base = (process.env.LOYALTY_URL ?? 'https://pl-loyalty-production.up.railway.app').replace(
  /\/$/,
  '',
);

const email = process.env.LOYALTY_SMOKE_EMAIL;
const password = process.env.LOYALTY_SMOKE_PASSWORD;

function jar() {
  const cookies = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const line of raw) {
        const [pair] = line.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    header() {
      if (cookies.size === 0) return undefined;
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

async function step(label, fn) {
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
  console.log(`Loyalty auth smoke → ${base}\n`);
  let ok = true;

  ok &&=
    (await step('Login page loads', async () => {
      const res = await fetch(`${base}/login`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    })) ?? false;

  ok &&=
    (await step('Unauthenticated session returns 401', async () => {
      const res = await fetch(`${base}/api/auth/session`, { credentials: 'include' });
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    })) ?? false;

  ok &&=
    (await step('Refresh without cookie returns 401', async () => {
      const res = await fetch(`${base}/api/auth/refresh`, { method: 'POST' });
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    })) ?? false;

  ok &&=
    (await step('Invalid login rejected', async () => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid@example.com', password: 'not-a-real-password' }),
      });
      if (res.status !== 401 && res.status !== 400) {
        throw new Error(`expected 401/400, got ${res.status}`);
      }
    })) ?? false;

  if (email && password) {
    const jarStore = jar();
    ok &&=
      (await step('Login with credentials sets session cookies', async () => {
        const res = await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        jarStore.store(res);
        if (!jarStore.header()) throw new Error('no Set-Cookie from login');
      })) ?? false;

    ok &&=
      (await step('Session returns access token after login', async () => {
        const res = await fetch(`${base}/api/auth/token`, {
          headers: { Cookie: jarStore.header() ?? '' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!body?.accessToken) throw new Error('missing accessToken');
      })) ?? false;

    ok &&=
      (await step('Refresh rotates access token', async () => {
        const refreshRes = await fetch(`${base}/api/auth/refresh`, {
          method: 'POST',
          headers: { Cookie: jarStore.header() ?? '' },
        });
        if (!refreshRes.ok) throw new Error(`HTTP ${refreshRes.status}`);
        jarStore.store(refreshRes);

        const res = await fetch(`${base}/api/auth/token`, {
          headers: { Cookie: jarStore.header() ?? '' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!body?.accessToken) throw new Error('missing accessToken');
      })) ?? false;

    ok &&=
      (await step('Logout clears session', async () => {
        const res = await fetch(`${base}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: jarStore.header() ?? '' },
        });
        if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
        const session = await fetch(`${base}/api/auth/session`, { credentials: 'include' });
        if (session.status !== 401) throw new Error(`expected 401 after logout, got ${session.status}`);
      })) ?? false;
  } else {
    console.log('\nℹ Set LOYALTY_SMOKE_EMAIL + LOYALTY_SMOKE_PASSWORD for full login/refresh/logout smoke.');
  }

  console.log(ok ? '\nAll smoke checks passed.' : '\nSome smoke checks failed.');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
