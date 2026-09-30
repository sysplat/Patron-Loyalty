#!/usr/bin/env node
/**
 * Enforce Patron Loyalty staff UI system on dashboard pages.
 * Source of truth: docs/guides/LOYALTY_STAFF_UI.md
 *
 * Usage:
 *   node scripts/architecture/check-loyalty-staff-ui.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dashboardDir = path.join(root, 'apps/loyalty/src/app/(dashboard)');

/** @type {{ file: string; rule: string; detail: string }[]} */
const violations = [];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === 'page.tsx') files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

const pages = walk(dashboardDir);

if (pages.length === 0) {
  console.error('❌ No dashboard pages found under apps/loyalty/src/app/(dashboard)');
  process.exit(1);
}

for (const file of pages) {
  const text = fs.readFileSync(file, 'utf8');
  const r = rel(file);

  if (!text.includes("from '@/components/dashboard'") && !text.includes('from "@/components/dashboard"')) {
    violations.push({
      file: r,
      rule: 'import-dashboard',
      detail: 'Must import PageShell (and peers) from @/components/dashboard',
    });
  }

  if (!/\bPageShell\b/.test(text)) {
    violations.push({
      file: r,
      rule: 'page-shell',
      detail: 'Must wrap the page in <PageShell>',
    });
  }

  if (/\bDASHBOARD_PAGE_HEADING_CLASS\b/.test(text)) {
    violations.push({
      file: r,
      rule: 'heading-class',
      detail: 'Use PageHeader instead of DASHBOARD_PAGE_HEADING_CLASS on pages',
    });
  }

  // Ban browser confirms and ad-hoc modal overlays (shared ConfirmDialog is OK in components/)
  if (/\bconfirm\s*\(/.test(text) || /\bwindow\.confirm\s*\(/.test(text)) {
    violations.push({
      file: r,
      rule: 'no-browser-confirm',
      detail: 'Use ConfirmDialog from @/components/dashboard — not window.confirm()',
    });
  }

  if (/function\s+EmptyState\b|const\s+EmptyState\s*=/.test(text)) {
    violations.push({
      file: r,
      rule: 'no-local-empty',
      detail: 'Use EmptyState from @/components/dashboard — do not redefine locally',
    });
  }

  if (/function\s+ConfirmActionDialog\b|function\s+Delete\w+Dialog\b/.test(text)) {
    violations.push({
      file: r,
      rule: 'no-local-confirm',
      detail: 'Use ConfirmDialog from @/components/dashboard — do not redefine locally',
    });
  }
}

if (violations.length > 0) {
  console.error('❌ Loyalty staff UI system violations:\n');
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}`);
    console.error(`    ${v.detail}\n`);
  }
  console.error('See docs/guides/LOYALTY_STAFF_UI.md and .cursor/rules/loyalty-staff-ui.mdc');
  process.exit(1);
}

console.log(`✅ Loyalty staff UI: ${pages.length} dashboard pages use shared primitives.`);
