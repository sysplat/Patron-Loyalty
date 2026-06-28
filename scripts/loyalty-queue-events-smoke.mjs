#!/usr/bin/env node
/**
 * Smoke-test QlessQ → LMS queue-events connector.
 *
 * Usage:
 *   LOYALTY_API_URL=https://pl-api.example.com/api/v1 \
 *   LOYALTY_INTEGRATION_API_KEY=loyalty_live_... \
 *   node scripts/loyalty-queue-events-smoke.mjs
 *
 *   pnpm audit:loyalty-queue-events-smoke   # loads .env / .env.local when present
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

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

const apiBase = (
  process.env.LOYALTY_API_URL ??
  process.env.API_URL ??
  'http://localhost:4000/api/v1'
).replace(/\/$/, '');

const apiKey = process.env.LOYALTY_INTEGRATION_API_KEY ?? process.env.LOYALTY_API_KEY;

if (!apiKey) {
  console.error('Missing LOYALTY_INTEGRATION_API_KEY (or LOYALTY_API_KEY)');
  process.exit(1);
}

const sourceId = `smoke-${randomUUID()}`;
const externalCustomerId = `smoke-cust-${randomUUID().slice(0, 8)}`;

const payload = {
  event: 'ticket.completed',
  sourceId,
  branchId: '00000000-0000-0000-0000-000000000001',
  customer: {
    externalId: externalCustomerId,
    name: 'Queue Events Smoke Patron',
    email: `smoke+${Date.now()}@example.com`,
    phone: '+15550001234',
  },
  occurredAt: new Date().toISOString(),
};

async function postQueueEvent(label) {
  const res = await fetch(`${apiBase}/loyalty/integrations/v1/queue-events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Loyalty-Api-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`${label}: HTTP ${res.status}`, JSON.stringify(body));
  if (!res.ok) {
    throw new Error(`${label} failed with HTTP ${res.status}`);
  }
  return body;
}

try {
  const first = await postQueueEvent('first delivery');
  if (!first.ok && !first.skipped) {
    throw new Error('Expected ok or skipped on first delivery');
  }

  const second = await postQueueEvent('retry (idempotent)');
  if (!second.idempotent) {
    throw new Error('Expected idempotent:true on duplicate queue-events delivery');
  }

  console.log('queue-events smoke passed');
} catch (err) {
  console.error('queue-events smoke failed:', err.message);
  process.exit(1);
}
