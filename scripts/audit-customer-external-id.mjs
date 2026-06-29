#!/usr/bin/env node
/**
 * Phase 1 connector identity audit — customers.external_id vs metadata JSON scan.
 *
 * Usage:
 *   bash scripts/with-railway-db.sh node scripts/audit-customer-external-id.mjs
 *   DATABASE_URL=... node scripts/audit-customer-external-id.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'packages/database/package.json'));
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL or APP_DATABASE_URL is required.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const [row] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE external_id IS NOT NULL AND TRIM(external_id) <> '') AS column_set,
      COUNT(*) FILTER (
        WHERE (external_id IS NULL OR TRIM(external_id) = '')
          AND metadata->>'externalId' IS NOT NULL
          AND TRIM(metadata->>'externalId') <> ''
      ) AS metadata_only,
      COUNT(*) FILTER (
        WHERE external_id IS NOT NULL AND TRIM(external_id) <> ''
          AND metadata->>'externalId' IS NOT NULL
          AND TRIM(metadata->>'externalId') <> ''
      ) AS both_set,
      COUNT(*) FILTER (
        WHERE (external_id IS NULL OR TRIM(external_id) = '')
          AND metadata->>'externalId' IS NOT NULL
          AND TRIM(metadata->>'externalId') <> ''
      ) AS metadata_without_column
    FROM customers
  `;

  const columnSet = Number(row.column_set);
  const metadataOnly = Number(row.metadata_only);
  const bothSet = Number(row.both_set);
  const needsBackfill = Number(row.metadata_without_column);

  console.log('=== Customer external_id audit ===');
  console.log(`column external_id set:     ${columnSet}`);
  console.log(`metadata externalId only:     ${metadataOnly}`);
  console.log(`both column + metadata:     ${bothSet}`);
  console.log(`needs column backfill:      ${needsBackfill}`);

  if (needsBackfill > 0) {
    console.warn(
      '\n⚠️  Legacy metadata-only connector IDs remain — run migration backfill or wait for self-heal on lookup.',
    );
    process.exit(1);
  }

  console.log('\n✅ No metadata-only external IDs without column — safe to set LOYALTY_CONNECTOR_LEGACY_METADATA_EXTERNAL_ID_LOOKUP=false');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
