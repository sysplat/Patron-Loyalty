#!/usr/bin/env node
/**
 * Fail when LMS docs imply QMS ships from this repo (apps/web, apps/admin)
 * without a sibling-repo qualifier. Baseline mode tracks known legacy docs.
 *
 * Usage:
 *   node scripts/architecture/check-lms-doc-boundaries.mjs
 *   node scripts/architecture/check-lms-doc-boundaries.mjs --update-baseline
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const docsDir = path.join(root, 'docs');
const baselinePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lms-doc-boundaries-baseline.json');
const updateBaseline = process.argv.includes('--update-baseline');

const QMS_QUALIFIER =
  /(\.\.\/QMS|QMS repo|sibling repo|sibling `?\.\.\/QMS|not in this (repo|workspace)|QMS-only|ships from the sibling)/i;

const APP_PATH = /apps\/(web|admin)\b/;

function collectMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectMarkdownFiles(full, files);
    else if (entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

function scanViolations() {
  const violations = [];
  for (const file of collectMarkdownFiles(docsDir)) {
    const rel = path.relative(root, file).replaceAll(path.sep, '/');
    const text = fs.readFileSync(file, 'utf8');
    if (!APP_PATH.test(text)) continue;
    if (QMS_QUALIFIER.test(text)) continue;
    violations.push(rel);
  }
  return violations.sort();
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return new Set();
  const data = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  return new Set(Array.isArray(data?.files) ? data.files : []);
}

function writeBaseline(files) {
  fs.writeFileSync(
    baselinePath,
    `${JSON.stringify({ files: files.sort(), updatedAt: new Date().toISOString().slice(0, 10) }, null, 2)}\n`,
  );
}

const violations = scanViolations();

if (updateBaseline) {
  writeBaseline(violations);
  console.log(`✅ LMS doc boundary baseline updated (${violations.length} tracked files).`);
  process.exit(0);
}

const baseline = readBaseline();
const untracked = violations.filter((f) => !baseline.has(f));
const resolved = [...baseline].filter((f) => !violations.includes(f));

if (untracked.length > 0) {
  console.error('❌ LMS doc boundary: new apps/web|apps/admin references without QMS qualifier:\n');
  for (const file of untracked) console.error(`  - ${file}`);
  console.error(
    '\nAdd a sibling-repo disclaimer or run --update-baseline after intentional legacy doc review.',
  );
  process.exit(1);
}

if (resolved.length > 0) {
  console.warn(
    `⚠️  ${resolved.length} baseline doc(s) now include QMS qualifiers — consider --update-baseline to shrink baseline.`,
  );
}

console.log(
  `✅ LMS doc boundary check passed (baseline mode). Tracked legacy docs: ${baseline.size}.`,
);
