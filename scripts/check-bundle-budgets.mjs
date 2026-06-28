#!/usr/bin/env node
/**
 * Loyalty app bundle budget gate (post-build). Skips when .next is absent.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loyaltyNext = path.join(root, 'apps/loyalty/.next');
const maxMb = Number(process.env.LOYALTY_BUNDLE_BUDGET_MB ?? '180');

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else if (entry.isFile()) total += statSync(full).size;
  }
  return total;
}

if (!existsSync(loyaltyNext)) {
  console.log('Bundle budget: skip (apps/loyalty/.next not found — run pnpm build in CI first)');
  process.exit(0);
}

const bytes = dirSizeBytes(loyaltyNext);
const mb = bytes / (1024 * 1024);
if (mb > maxMb) {
  console.error(`Bundle budget exceeded: apps/loyalty/.next is ${mb.toFixed(1)}MB (max ${maxMb}MB)`);
  process.exit(1);
}

console.log(`Bundle budget OK: apps/loyalty/.next ${mb.toFixed(1)}MB / ${maxMb}MB`);
