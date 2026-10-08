#!/usr/bin/env node
/**
 * Enforce the Patron Loyalty patron UI system on public patron surfaces.
 * Source of truth: docs/guides/LOYALTY_PATRON_UI.md
 *
 * Usage:
 *   node scripts/architecture/check-loyalty-patron-ui.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Branded patron surfaces: merchant branding must flow through the shared primitives. */
const PATRON_PAGES = [
  'apps/loyalty/src/app/(public)/portal/[code]/page.tsx',
  'apps/loyalty/src/app/(public)/card/[code]/page.tsx',
  'apps/loyalty/src/app/(public)/refer/[code]/page.tsx',
];

/** @type {{ file: string; rule: string; detail: string }[]} */
const violations = [];

for (const relPath of PATRON_PAGES) {
  const file = path.join(root, relPath);
  if (!fs.existsSync(file)) {
    violations.push({
      file: relPath,
      rule: 'missing-page',
      detail: 'Expected patron surface is missing — update this gate if the route moved',
    });
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');

  if (!text.includes("from '@/components/patron'")) {
    violations.push({
      file: relPath,
      rule: 'import-patron',
      detail: 'Must import patron primitives from @/components/patron',
    });
  }

  if (!/\bPatronShell\b/.test(text)) {
    violations.push({
      file: relPath,
      rule: 'patron-shell',
      detail: 'Must wrap the page in <PatronShell> so brand variables are applied',
    });
  }

  if (!/\bresolvePatronBranding\b/.test(text)) {
    violations.push({
      file: relPath,
      rule: 'resolve-branding',
      detail: 'Must derive branding via resolvePatronBranding(data)',
    });
  }

  if (/<input\b/.test(text)) {
    violations.push({
      file: relPath,
      rule: 'no-raw-input',
      detail: 'Use PatronInput / PatronCheckbox instead of a raw <input>',
    });
  }

  const hardcodedBrandColor = /\b(?:bg|text|border)-(?:emerald|sky|teal|indigo)-\d{3}\b/.exec(text);
  if (hardcodedBrandColor) {
    violations.push({
      file: relPath,
      rule: 'no-hardcoded-brand-color',
      detail: `Use var(--patron-primary) / var(--patron-accent) instead of ${hardcodedBrandColor[0]}`,
    });
  }
}

if (violations.length > 0) {
  console.error('❌ Loyalty patron UI system violations:\n');
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}`);
    console.error(`    ${v.detail}\n`);
  }
  console.error('See docs/guides/LOYALTY_PATRON_UI.md');
  process.exit(1);
}

console.log(`✅ Loyalty patron UI: ${PATRON_PAGES.length} patron surfaces use shared primitives.`);
