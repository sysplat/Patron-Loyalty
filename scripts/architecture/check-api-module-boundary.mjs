import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const apiModulesDir = path.resolve(repoRoot, 'packages/api/src/modules');
const baselinePath = path.resolve(__dirname, 'api-module-boundary-baseline.json');
const updateBaseline = process.argv.includes('--update-baseline');

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

function extractModuleName(absPath) {
  const rel = path.relative(apiModulesDir, absPath).replaceAll(path.sep, '/');
  const [moduleName] = rel.split('/');
  return moduleName;
}

function resolveImportPath(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, path.join(base, 'index.ts')];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

function scanViolations() {
  const files = collectFilesRecursively(apiModulesDir).filter((f) => !f.endsWith('.spec.ts'));
  const violations = [];

  for (const file of files) {
    const sourceModule = extractModuleName(file);
    const relFile = path.relative(repoRoot, file).replaceAll(path.sep, '/');
    const lines = fs.readFileSync(file, 'utf8').split('\n');

    for (const line of lines) {
      const importMatch =
        line.match(/from\s+'(\.[^']+)'/) ?? line.match(/from\s+"(\.[^"]+)"/);
      if (!importMatch) continue;
      const specifier = importMatch[1];
      const resolved = resolveImportPath(file, specifier);
      if (!resolved) continue;
      if (!resolved.includes(`${path.sep}packages${path.sep}api${path.sep}src${path.sep}modules${path.sep}`)) {
        continue;
      }

      const targetModule = extractModuleName(resolved);
      if (!targetModule || targetModule === sourceModule) continue;

      const signature = `${sourceModule}->${targetModule}|${relFile}|${specifier}`;
      violations.push({
        signature,
        sourceModule,
        targetModule,
        file: relFile,
        importPath: specifier,
      });
    }
  }

  return violations;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return new Set();
  const data = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const entries = Array.isArray(data?.violations) ? data.violations : [];
  return new Set(entries.filter((entry) => typeof entry === 'string'));
}

function writeBaseline(signatures) {
  const sorted = [...signatures].sort((a, b) => a.localeCompare(b));
  const payload = {
    generatedAt: new Date().toISOString(),
    description: 'Existing cross-module imports in packages/api/src/modules (baseline mode).',
    violations: sorted,
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function run() {
  const violations = scanViolations();
  const current = new Set(violations.map((v) => v.signature));

  if (updateBaseline) {
    writeBaseline(current);
    console.log(`✅ API module-boundary baseline updated (${current.size} entries).`);
    return;
  }

  const baseline = readBaseline();
  const newViolations = violations.filter((v) => !baseline.has(v.signature));
  if (newViolations.length > 0) {
    for (const violation of newViolations) {
      console.error('[API MODULE BOUNDARY ERROR] Forbidden new cross-module import');
      console.error(`From module: ${violation.sourceModule}`);
      console.error(`To module:   ${violation.targetModule}`);
      console.error(`File:        ${violation.file}`);
      console.error(`Import:      ${violation.importPath}\n`);
    }
    console.error(
      `API module boundary check failed with ${newViolations.length} new violation(s). ` +
        `If this is an intentional baseline refresh, run: node scripts/architecture/check-api-module-boundary.mjs --update-baseline`,
    );
    process.exit(1);
  }

  console.log(
    `✅ API module boundary check passed (baseline mode). Tracked cross-module imports: ${current.size}.`,
  );
}

run();
