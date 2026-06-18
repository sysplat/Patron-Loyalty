#!/usr/bin/env node
/**
 * Enterprise ops-gate checks (local or staging).
 *
 * Usage:
 *   pnpm check:ops-gates
 *   API_BASE=https://staging.example.com/api/v1 CENTRIFUGO_WEBHOOK_SECRET=... pnpm check:ops-gates
 */

import fs from 'node:fs';
import path from 'node:path';

const API_BASE = (process.env.API_BASE || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const WEBHOOK_SECRET = (process.env.CENTRIFUGO_WEBHOOK_SECRET || '').trim();

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`WARN: ${msg}`);
}

function pass(msg) {
  console.log(`OK: ${msg}`);
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health/live`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      fail(`GET /health/live returned ${res.status}`);
      return;
    }
    pass('API liveness');
  } catch (err) {
    fail(`API not reachable at ${API_BASE} (${err instanceof Error ? err.message : err})`);
  }
}

async function checkRealtimeWebhook() {
  if (!WEBHOOK_SECRET) {
    warn('CENTRIFUGO_WEBHOOK_SECRET unset — skipping webhook auth check');
    return;
  }

  const body = JSON.stringify({ method: 'connect', params: { user: 'ops-gate-smoke' } });

  const bad = await fetch(`${API_BASE}/realtime/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-centrifugo-webhook-secret': 'wrong' },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (bad.status !== 401) {
    fail(`Webhook with bad secret expected 401, got ${bad.status}`);
  } else {
    pass('Webhook rejects invalid secret');
  }

  const good = await fetch(`${API_BASE}/realtime/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-centrifugo-webhook-secret': WEBHOOK_SECRET,
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!good.ok) {
    fail(`Webhook with valid secret expected 200, got ${good.status}`);
    return;
  }
  const json = await good.json().catch(() => null);
  if (!json || typeof json.result !== 'object') {
    fail('Webhook response missing result object');
  } else {
    pass('Webhook accepts valid secret');
  }
}

function checkEnvDocs() {
  const root = process.cwd();
  const requiredDocs = [
    'docs/qa/SERVE_SURFACE_MIGRATION_RUNBOOK.md',
    'docs/operations/FINAL_PRE_RELEASE_AUDIT.md',
    'docs/deployment/OPS_GATE_REALTIME.md',
  ];
  for (const doc of requiredDocs) {
    const full = path.join(root, doc);
    if (!fs.existsSync(full)) {
      fail(`Missing runbook: ${doc}`);
    } else {
      pass(`Runbook present: ${doc}`);
    }
  }
}

async function main() {
  console.log(`Ops gate checks (API_BASE=${API_BASE})`);
  checkEnvDocs();
  await checkHealth();
  await checkRealtimeWebhook();

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s).`);
  }
  if (failures.length) {
    console.error(`\n${failures.length} failure(s).`);
    process.exit(1);
  }
  console.log('\nOps gate checks passed.');
}

main();
