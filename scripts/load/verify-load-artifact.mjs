#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/load/verify-load-artifact.mjs <artifact-path>');
  process.exit(1);
}

const MAX_P95_MS = Number.parseInt(process.env.LOAD_MAX_P95_MS || '800', 10);
const MAX_5XX = Number.parseInt(process.env.LOAD_MAX_5XX || '0', 10);
const MAX_DUPLICATES = Number.parseInt(process.env.LOAD_MAX_DUPLICATES || '0', 10);

function fail(message) {
  console.error(`[verify-load] ${message}`);
  process.exit(1);
}

async function main() {
  const raw = await readFile(input, 'utf8');
  const parsed = JSON.parse(raw);
  const summary = parsed?.summary;
  if (!summary) fail('artifact missing summary');

  const p95 = Number(summary?.latencyMs?.p95 ?? 0);
  const server5xx = Number(summary?.totals?.server5xx ?? 0);
  const duplicates = Number(summary?.duplicateDisplayNumbers?.length ?? 0);

  if (p95 > MAX_P95_MS) fail(`p95 latency ${p95}ms exceeds threshold ${MAX_P95_MS}ms`);
  if (server5xx > MAX_5XX) fail(`5xx count ${server5xx} exceeds threshold ${MAX_5XX}`);
  if (duplicates > MAX_DUPLICATES) fail(`duplicate display numbers ${duplicates} exceeds threshold ${MAX_DUPLICATES}`);

  console.log('[verify-load] PASS');
  console.log(
    JSON.stringify(
      {
        p95,
        server5xx,
        duplicates,
        thresholds: { MAX_P95_MS, MAX_5XX, MAX_DUPLICATES },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
