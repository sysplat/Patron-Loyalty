-- Integration txn ids (e.g. INV-2024-001) are VarChar, not UUID.
ALTER TABLE "loyalty_point_ledger"
  ALTER COLUMN "source_id" TYPE VARCHAR(100) USING "source_id"::text;

ALTER TABLE "loyalty_wallet_transactions"
  ALTER COLUMN "source_id" TYPE VARCHAR(100) USING "source_id"::text;

-- Idempotent earn ledger: one earn/bonus row per org + account + source (QlessQ connector retries).
-- Ledger types are uppercase (EARN, BONUS) per LOYALTY_POINT_LEDGER_TYPES.
DROP INDEX IF EXISTS "loyalty_point_ledger_earn_source_idempotent_idx";

CREATE UNIQUE INDEX "loyalty_point_ledger_earn_source_idempotent_idx"
ON "loyalty_point_ledger" ("org_id", "account_id", "source_type", "source_id")
WHERE "source_type" IS NOT NULL
  AND "source_id" IS NOT NULL
  AND "type" IN ('EARN', 'BONUS');
