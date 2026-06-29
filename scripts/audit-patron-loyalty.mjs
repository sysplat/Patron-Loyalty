#!/usr/bin/env node
/**
 * Patron Loyalty (LMS) consolidated audit — code quality, security guards,
 * prod smoke, migration gate, SRS snapshot.
 *
 * Usage:
 *   node scripts/audit-patron-loyalty.mjs
 *   node scripts/audit-patron-loyalty.mjs --write-report
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const writeReport = process.argv.includes('--write-report');
const loyaltyUrl = (process.env.LOYALTY_URL ?? 'https://pl-loyalty-production.up.railway.app').replace(
  /\/$/,
  '',
);

/** @type {{ id: string, category: string, status: 'pass'|'fail'|'skip'|'warn', detail: string }[]} */
const results = [];

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    ...opts,
  });
}

function record(id, category, status, detail) {
  results.push({ id, category, status, detail });
  const icon = { pass: '✅', fail: '❌', skip: '⏭', warn: '⚠️' }[status];
  console.log(`${icon} [${category}] ${id}: ${detail}`);
}

function runScript(id, category, scriptPath, tailOnFail = true) {
  if (!existsSync(path.join(root, scriptPath))) {
    record(id, category, 'skip', `missing ${scriptPath}`);
    return;
  }
  const res = run('node', [scriptPath]);
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  if (res.status === 0) {
    record(id, category, 'pass', out.split('\n').at(-1) ?? 'ok');
  } else {
    const detail = tailOnFail ? out.split('\n').slice(-3).join(' ') : out.slice(0, 200);
    record(id, category, 'fail', detail || `exit ${res.status}`);
  }
}

function runPnpm(id, category, script) {
  const res = run('pnpm', [script], { shell: true });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  if (res.status === 0) {
    record(id, category, 'pass', out.split('\n').filter(Boolean).at(-1) ?? 'ok');
  } else {
    record(id, category, 'fail', out.split('\n').slice(-2).join(' ') || `exit ${res.status}`);
  }
}

async function fetchStatus(id, category, urlPath, expect = 200) {
  try {
    const res = await fetch(`${loyaltyUrl}${urlPath}`, { redirect: 'follow' });
    if (res.status === expect) {
      record(id, category, 'pass', `HTTP ${res.status} ${urlPath}`);
    } else {
      record(id, category, 'fail', `HTTP ${res.status} (expected ${expect}) ${urlPath}`);
    }
  } catch (err) {
    record(id, category, 'fail', err instanceof Error ? err.message : String(err));
  }
}

function checkLoyaltyAuthGuards() {
  const middleware = readFileSync(path.join(root, 'apps/loyalty/src/middleware.ts'), 'utf8');
  const authStore = readFileSync(path.join(root, 'apps/loyalty/src/lib/auth-store.ts'), 'utf8');
  const layout = readFileSync(path.join(root, 'apps/loyalty/src/app/(dashboard)/layout.tsx'), 'utf8');
  const issues = [];
  if (!middleware.includes('WEB_SESSION_COOKIE')) issues.push('middleware missing WEB_SESSION_COOKIE');
  if (!middleware.includes('WEB_REFRESH_COOKIE')) issues.push('middleware missing WEB_REFRESH_COOKIE');
  if (!authStore.includes("partialize: (state) => ({ user: state.user })")) {
    issues.push('auth store must not persist accessToken in localStorage');
  }
  if (authStore.includes('localStorage.setItem(') && authStore.includes('accessToken')) {
    issues.push('auth store writes accessToken to localStorage');
  }
  if (!layout.includes('/api/auth/refresh')) {
    issues.push('dashboard layout missing refresh fallback');
  }
  if (issues.length) {
    record('loyalty-auth-guards', 'Security', 'fail', issues.join('; '));
  } else {
    record('loyalty-auth-guards', 'Security', 'pass', 'HttpOnly cookies, token not persisted, refresh fallback');
  }
}

function srsSnapshot() {
  const doc = path.join(root, 'docs/architecture/srs-completion.md');
  if (!existsSync(doc)) {
    record('srs-completion-doc', 'SRS', 'skip', 'docs/architecture/srs-completion.md missing');
    return;
  }
  const text = readFileSync(doc, 'utf8');
  const overall = text.match(/\*\*Overall:\*\* ~?\*\*(\d+)%\*\*/);
  record(
    'srs-completion-doc',
    'SRS',
    'pass',
    overall ? `Overall SRS ~${overall[1]}% (see srs-completion.md)` : 'srs-completion.md present',
  );
}

function gitHead() {
  const res = run('git', ['log', '-1', '--format=%h %s']);
  if (res.status === 0) {
    record('git-head', 'Deploy', 'pass', (res.stdout ?? '').trim());
  } else {
    record('git-head', 'Deploy', 'skip', 'not a git repo');
  }
}

function writeReportFile() {
  const date = new Date().toISOString().slice(0, 10);
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const skip = results.filter((r) => r.status === 'skip').length;
  const warn = results.filter((r) => r.status === 'warn').length;
  const reportPath = path.join(root, 'docs/operations/PATRON_LOYALTY_AUDIT_REPORT.md');

  const table = results
    .map((r) => `| ${r.id} | ${r.category} | ${r.status.toUpperCase()} | ${r.detail.replace(/\|/g, '\\|')} |`)
    .join('\n');

  const body = `# Patron Loyalty audit report

**Date:** ${date}  
**Prod URL:** ${loyaltyUrl}  
**Command:** \`pnpm audit:patron-loyalty\`

## Summary

| Result | Count |
|--------|------:|
| Pass | ${pass} |
| Fail | ${fail} |
| Skip | ${skip} |
| Warn | ${warn} |

**Verdict:** ${fail === 0 ? '**PASS** (no blocking failures)' : '**FAIL** (resolve blocking items before release)'}

**Unit tests:** Full \`pnpm test\` (api + shared + notifications + loyalty) is included in the \`unit-tests\` check.

**E2E:** Playwright smoke (\`@queueplatform/e2e\`) runs in CI job \`test-e2e-loyalty\`; optional locally via \`pnpm --filter @queueplatform/e2e test\`.

## Checklist

| Check | Category | Status | Detail |
|-------|----------|--------|--------|
${table}

## Manual follow-ups

- [ ] \`railway link\` → \`pnpm db:migrate:status:railway\` (migration \`20260627120000_srs_crm_gamification_locale\`)
- [ ] Set \`LOYALTY_SMOKE_EMAIL\` / \`LOYALTY_SMOKE_PASSWORD\` GitHub secrets (optional — CI seeds \`ci-loyalty-staff@queueplatform.test\`)
- [ ] Set \`INTEGRATION_DATABASE_URL\` for pre-release DB golden-path spec (\`pnpm audit:loyalty-integration-db\`)
- [ ] Set \`LOYALTY_INTEGRATION_API_KEY\` and run \`pnpm audit:loyalty-queue-events-smoke\`
- [ ] Counsel sign-off per \`docs/compliance/PATRON_LOYALTY_LAUNCH_CHECKLIST.md\`
- [ ] QlessQ connector smoke: ticket complete → points ledger (or queue-events smoke script)
- [ ] Webhook: create endpoint + rotate signing secret on prod
- [ ] Set \`TWILIO_WHATSAPP_NUMBER\` if using WhatsApp campaigns

## References

- [Testing guide](./TESTING.md) — LMS commands, CI matrix, release gates
- [Test audit baseline](./TEST_AUDIT_BASELINE.md)
- [SRS completion map](../architecture/srs-completion.md)
- [Launch checklist](../compliance/PATRON_LOYALTY_LAUNCH_CHECKLIST.md)
- [Final pre-release audit](./FINAL_PRE_RELEASE_AUDIT.md) (QMS legacy — partial applicability)
`;

  writeFileSync(reportPath, body);
  console.log(`\n📄 Report written: docs/operations/PATRON_LOYALTY_AUDIT_REPORT.md`);
}

function runLoyaltyIntegrationDb() {
  const dbUrl = process.env.INTEGRATION_DATABASE_URL;
  if (!dbUrl) {
    record(
      'loyalty-integration-db',
      'Tests',
      'skip',
      'set INTEGRATION_DATABASE_URL for earn/idempotency golden-path spec',
    );
    return;
  }
  const res = run(
    'pnpm',
    ['audit:loyalty-integration-db'],
    { shell: true, env: { ...process.env, INTEGRATION_DATABASE_URL: dbUrl } },
  );
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  if (res.status === 0) {
    record('loyalty-integration-db', 'Tests', 'pass', out.split('\n').filter(Boolean).at(-1) ?? 'ok');
  } else {
    record('loyalty-integration-db', 'Tests', 'fail', out.split('\n').slice(-2).join(' ') || `exit ${res.status}`);
  }
}

async function main() {
  console.log(`\n=== Patron Loyalty audit ===\nTarget: ${loyaltyUrl}\n`);

  gitHead();
  runPnpm('validate-ci', 'Code quality', 'validate:ci');
  runPnpm('loyalty-coverage', 'Tests', 'audit:loyalty-coverage');
  runLoyaltyIntegrationDb();
  runPnpm('unit-tests', 'Tests', 'test');
  runScript('legal-placeholders', 'Compliance', 'scripts/compliance/check-legal-placeholders.mjs');
  checkLoyaltyAuthGuards();
  srsSnapshot();

  const soakRes = run('node', ['scripts/staging-soak-patron-loyalty.mjs']);
  if (soakRes.status === 0) {
    record('staging-soak', 'Prod smoke', 'pass', 'boundary curls OK');
  } else {
    const detail = `${soakRes.stderr ?? ''}${soakRes.stdout ?? ''}`.trim().split('\n').at(-1);
    record('staging-soak', 'Prod smoke', 'warn', detail ?? 'soak failed');
  }

  runPnpm('prod-migration', 'Database', 'db:migrate:status:railway');
  runPnpm('loyalty-auth-smoke', 'Prod smoke', 'audit:loyalty-auth-smoke');

  const sentryRes = run('node', ['scripts/verify-sentry-prod.mjs']);
  if (sentryRes.status === 0) {
    record('sentry-prod', 'Operability', 'pass', 'health/meta sentryEnabled');
  } else {
    const detail = `${sentryRes.stderr ?? ''}${sentryRes.stdout ?? ''}`.trim().split('\n').at(-1);
    record('sentry-prod', 'Operability', 'warn', detail ?? 'sentry not enabled on pl-api');
  }

  await fetchStatus('prod-login', 'Prod smoke', '/login');
  await fetchStatus('prod-manifest', 'Prod smoke', '/manifest.webmanifest');
  await fetchStatus('prod-icon-192', 'Prod smoke', '/brand/icon-192.png');
  await fetchStatus('prod-session-unauth', 'Prod smoke', '/api/auth/session', 401);

  const fail = results.filter((r) => r.status === 'fail').length;
  console.log(`\n=== Done: ${results.length} checks, ${fail} failure(s) ===\n`);

  if (writeReport) writeReportFile();

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
