#!/usr/bin/env node
/**
 * Phase 3 exit gate — ≥10 loyalty Playwright specs in @queueplatform/e2e.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(root, 'packages/e2e/tests');
const MIN = 10;

const loyaltySpecs = readdirSync(testsDir).filter(
  (name) => name.startsWith('loyalty-') && name.endsWith('.spec.ts'),
);

if (loyaltySpecs.length < MIN) {
  console.error(`❌ ${loyaltySpecs.length} loyalty E2E specs (need ≥${MIN})`);
  process.exit(1);
}

console.log(`✅ ${loyaltySpecs.length} loyalty E2E specs (≥${MIN})`);
