-- Ticket retention / consent controls
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "legal_hold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "transactional_sms_allowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "marketing_sms_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "marketing_sms_opt_in_at" TIMESTAMP(3);

-- Customer-level consent state
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "transactional_sms_allowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "marketing_sms_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "marketing_sms_opt_in_at" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "sms_consent_source" VARCHAR(30);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "sms_consent_version" VARCHAR(30);

CREATE INDEX IF NOT EXISTS "tickets_org_id_legal_hold_status_booked_at_idx"
    ON "tickets"("org_id", "legal_hold", "status", "booked_at");

CREATE INDEX IF NOT EXISTS "customers_org_id_marketing_sms_opt_in_idx"
    ON "customers"("org_id", "marketing_sms_opt_in");

-- Tenant isolation strategy: precreate policies so rollout can enable RLS table-by-table
-- without additional DDL at deploy time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tickets'
      AND policyname = 'tickets_tenant_isolation'
  ) THEN
    CREATE POLICY "tickets_tenant_isolation"
      ON "tickets"
      USING ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'customers_tenant_isolation'
  ) THEN
    CREATE POLICY "customers_tenant_isolation"
      ON "customers"
      USING ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK ("org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;
