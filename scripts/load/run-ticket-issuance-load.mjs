#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const API_BASE = (process.env.LOAD_TEST_BASE_URL || process.env.API_BASE || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const SCENARIO = process.env.LOAD_TEST_SCENARIO === 'join' ? 'join' : 'issue';
const TOTAL_REQUESTS = clampInt(process.env.LOAD_TEST_TOTAL_REQUESTS, 100, 1, 10_000);
const CONCURRENCY = clampInt(process.env.LOAD_TEST_CONCURRENCY, 20, 1, 500);
const STAGGER_MS = clampInt(process.env.LOAD_TEST_STAGGER_MS, 8, 0, 10_000);
const ARTIFACT_DIR = process.env.LOAD_TEST_ARTIFACT_DIR || 'scripts/load/artifacts';

const ORG_ID = mustEnv('LOAD_TEST_ORG_ID');
const BRANCH_ID = mustEnv('LOAD_TEST_BRANCH_ID');
const QUEUE_ID = mustEnv('LOAD_TEST_QUEUE_ID');
const SERVICE_ID = mustEnv('LOAD_TEST_SERVICE_ID');

const scenarioPath = SCENARIO === 'join' ? '/service-queue/join' : '/tickets/issue';

function mustEnv(key) {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value.trim();
}

function clampInt(raw, fallback, min, max) {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function makeBody(index) {
  const stamp = `${Date.now()}-${index}`;
  const base = {
    orgId: ORG_ID,
    branchId: BRANCH_ID,
    queueId: QUEUE_ID,
    serviceId: SERVICE_ID,
    customerName: `Load ${stamp}`,
    customerPhone: `+1555${String(index).padStart(7, '0')}`,
    language: 'en',
    transactionalSmsAllowed: false,
    marketingSmsOptIn: false,
  };
  if (SCENARIO === 'join') return base;
  return { ...base, source: 'load-test' };
}

async function requestOnce(index) {
  const body = makeBody(index);
  const start = performance.now();
  let status = 0;
  let parsed = null;
  try {
    const res = await fetch(`${API_BASE}${scenarioPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    status = res.status;
    const text = await res.text();
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
  } catch (error) {
    return {
      index,
      elapsedMs: Math.round(performance.now() - start),
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      displayNumber: null,
      ticketId: null,
    };
  }

  const elapsedMs = Math.round(performance.now() - start);
  const data = parsed?.data ?? parsed;
  const displayNumber = data?.displayNumber ?? data?.ticket_number ?? null;
  const ticketId = data?.id ?? data?.token ?? null;

  return {
    index,
    elapsedMs,
    status,
    ok: status >= 200 && status < 300,
    error: null,
    displayNumber,
    ticketId,
  };
}

async function run() {
  const startedAt = new Date().toISOString();
  console.log(`[load] scenario=${SCENARIO} endpoint=${scenarioPath}`);
  console.log(`[load] total=${TOTAL_REQUESTS} concurrency=${CONCURRENCY} stagger=${STAGGER_MS}ms`);

  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, TOTAL_REQUESTS) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= TOTAL_REQUESTS) return;
      if (STAGGER_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, STAGGER_MS));
      }
      const result = await requestOnce(current);
      results.push(result);
    }
  });

  await Promise.all(workers);

  const endedAt = new Date().toISOString();
  const elapsed = results.map((r) => r.elapsedMs);
  const byStatus = new Map();
  for (const r of results) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  }
  const success = results.filter((r) => r.ok);
  const duplicateDisplayNumbers = Object.entries(
    success.reduce((acc, row) => {
      if (!row.displayNumber) return acc;
      acc[row.displayNumber] = (acc[row.displayNumber] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .filter(([, count]) => count > 1)
    .map(([displayNumber, count]) => ({ displayNumber, count }));

  const summary = {
    scenario: SCENARIO,
    startedAt,
    endedAt,
    request: {
      total: TOTAL_REQUESTS,
      concurrency: CONCURRENCY,
      staggerMs: STAGGER_MS,
      endpoint: `${API_BASE}${scenarioPath}`,
    },
    totals: {
      success: success.length,
      throttled429: byStatus.get(429) ?? 0,
      server5xx: [...byStatus.entries()].filter(([s]) => s >= 500 && s < 600).reduce((sum, [, c]) => sum + c, 0),
      networkErrors: byStatus.get(0) ?? 0,
    },
    latencyMs: {
      p50: percentile(elapsed, 50),
      p95: percentile(elapsed, 95),
      p99: percentile(elapsed, 99),
      max: elapsed.length ? Math.max(...elapsed) : 0,
    },
    statusBreakdown: Object.fromEntries([...byStatus.entries()].sort((a, b) => a[0] - b[0])),
    duplicateDisplayNumbers,
  };

  await mkdir(ARTIFACT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(ARTIFACT_DIR, `load-${SCENARIO}-${stamp}.json`);
  await writeFile(outputPath, JSON.stringify({ summary, results }, null, 2), 'utf8');

  console.log('[load] summary');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`[load] artifact=${outputPath}`);

  if (summary.totals.server5xx > 0 || summary.duplicateDisplayNumbers.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(`[load] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
