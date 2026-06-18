import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const apiDir = path.resolve(repoRoot, 'packages/api/src');
const reviewFile = path.resolve(__dirname, 'rls-bypass-review.json');

function collectFilesRecursively(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir)) {
    const next = path.join(dir, entry);
    const stat = fs.statSync(next);
    if (stat.isDirectory()) {
      results = results.concat(collectFilesRecursively(next));
    } else if (next.endsWith('.ts')) {
      results.push(next);
    }
  }
  return results;
}

function findBypassCallsites() {
  const files = collectFilesRecursively(apiDir).filter((f) => !f.endsWith('.spec.ts'));
  const callsites = [];

  for (const file of files) {
    const relFile = path.relative(repoRoot, file).replaceAll(path.sep, '/');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('.withBypassRls(')) continue;
      const lineText = line.trim();
      const signature = `${relFile}|${lineText}`;
      callsites.push({
        signature,
        file: relFile,
        line: i + 1,
        lineText,
      });
    }
  }

  return callsites;
}

function run() {
  if (!fs.existsSync(reviewFile)) {
    console.error('RLS bypass review file is missing: scripts/security/rls-bypass-review.json');
    process.exit(1);
  }

  const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
  const reviewed = review?.reviewed;
  if (!reviewed || typeof reviewed !== 'object') {
    console.error('Invalid rls-bypass-review.json: expected { reviewed: { signature: reason } }');
    process.exit(1);
  }

  const callsites = findBypassCallsites();
  let hasErrors = false;

  for (const callsite of callsites) {
    const reason = reviewed[callsite.signature];
    if (typeof reason !== 'string' || reason.trim().length < 8) {
      hasErrors = true;
      console.error('[RLS BYPASS REVIEW ERROR] Missing or too-short review reason');
      console.error(`File: ${callsite.file}:${callsite.line}`);
      console.error(`Line: ${callsite.lineText}`);
      console.error(`Signature: ${callsite.signature}\n`);
    }
  }

  if (hasErrors) {
    console.error(
      'RLS bypass review check failed. Document each withBypassRls callsite in scripts/security/rls-bypass-review.json',
    );
    process.exit(1);
  }

  console.log(`✅ RLS bypass review check passed (${callsites.length} callsites reviewed).`);
}

run();
