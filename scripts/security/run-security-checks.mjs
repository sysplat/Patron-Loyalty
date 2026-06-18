import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const checks = [
  {
    id: 'public-safeguards',
    script: 'scripts/security/check-public-safeguards.mjs',
  },
  {
    id: 'auth-remediation',
    script: 'scripts/security/check-auth-remediation-guards.mjs',
  },
  {
    id: 'display-session',
    script: 'scripts/security/check-display-session-guards.mjs',
  },
  {
    id: 'tenant-isolation',
    script: 'scripts/security/check-tenant-isolation.mjs',
  },
  {
    id: 'rls-bypass-review',
    script: 'scripts/security/check-rls-bypass-review.mjs',
  },
];

const results = [];

for (const check of checks) {
  const startedAt = Date.now();
  const proc = spawnSync('node', [check.script], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt;
  const ok = proc.status === 0;
  results.push({
    id: check.id,
    ok,
    durationMs,
    exitCode: proc.status ?? 1,
    output: `${proc.stdout ?? ''}${proc.stderr ?? ''}`.trim(),
  });
}

console.log('Security checks report');
console.log('======================');
for (const result of results) {
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`- [${status}] ${result.id} (${result.durationMs}ms)`);
  if (!result.ok && result.output) {
    console.log(result.output);
    console.log('');
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`Summary: ${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) {
  console.error(`Failed checks: ${failed.map((r) => r.id).join(', ')}`);
  process.exit(1);
}
