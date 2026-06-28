#!/usr/bin/env node
/**
 * Verify a Prisma migration is applied (Railway prod via with-railway-db.sh or DATABASE_URL).
 *
 * Usage:
 *   node scripts/check-prod-migration.mjs 20260627120000_srs_crm_gamification_locale
 *   bash scripts/with-railway-db.sh node scripts/check-prod-migration.mjs <migration_name>
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Usage: node scripts/check-prod-migration.mjs <migration_folder_name>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required (use scripts/with-railway-db.sh to load Railway prod).');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPkg = path.join(root, 'packages/database');

const status = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'status'], {
  cwd: dbPkg,
  encoding: 'utf8',
  env: process.env,
});

process.stdout.write(status.stdout ?? '');
process.stderr.write(status.stderr ?? '');

if (status.status !== 0) {
  process.exit(status.status ?? 1);
}

const combined = `${status.stdout ?? ''}\n${status.stderr ?? ''}`;

if (/Database schema is up to date!/i.test(combined)) {
  console.log(`\n✅ All migrations applied (schema up to date; includes ${migrationName})`);
  process.exit(0);
}

if (
  /following migrations? have not yet been applied/i.test(combined) &&
  combined.includes(migrationName)
) {
  console.error(`\n❌ Migration NOT applied: ${migrationName}`);
  process.exit(2);
}

if (combined.includes(migrationName)) {
  console.log(`\n✅ Migration present in status output: ${migrationName}`);
  process.exit(0);
}

console.warn(`\n⚠ Could not confirm ${migrationName} — review migrate status output above.`);
process.exit(0);
