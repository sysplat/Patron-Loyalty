-- Integration ingest event log for tenant Diagnostics (redacted payloads only).
CREATE TABLE IF NOT EXISTS "loyalty_integration_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "route" VARCHAR(80) NOT NULL,
  "event" VARCHAR(80),
  "source_id" VARCHAR(120),
  "outcome" VARCHAR(30) NOT NULL,
  "http_status" INTEGER,
  "duration_ms" INTEGER,
  "request_id" VARCHAR(80),
  "idempotency_key" VARCHAR(120),
  "redacted_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_integration_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "loyalty_integration_events"
  ADD CONSTRAINT "loyalty_integration_events_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "loyalty_integration_events_org_id_created_at_idx"
  ON "loyalty_integration_events"("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "loyalty_integration_events_org_id_route_created_at_idx"
  ON "loyalty_integration_events"("org_id", "route", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "loyalty_integration_events_org_id_request_id_idx"
  ON "loyalty_integration_events"("org_id", "request_id");

DO $$
BEGIN
  DROP POLICY IF EXISTS loyalty_integration_events_tenant_isolation ON loyalty_integration_events;
  CREATE POLICY loyalty_integration_events_tenant_isolation ON loyalty_integration_events
    USING (
      current_setting('app.bypass_rls', true) = 'on'
      OR org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
    WITH CHECK (
      org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );
  ALTER TABLE loyalty_integration_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE loyalty_integration_events FORCE ROW LEVEL SECURITY;
END $$;
