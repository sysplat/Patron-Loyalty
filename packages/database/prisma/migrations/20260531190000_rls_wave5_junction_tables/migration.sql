-- Wave 5 RLS rollout for junction/child tables without direct org_id.
-- Tenant scope is derived from parent rows (branches, services, queues).
-- Read-path bypass via app.bypass_rls; writes require matching parent org.

-- working_hours (via branch)
DROP POLICY IF EXISTS "working_hours_tenant_isolation" ON "working_hours";
CREATE POLICY "working_hours_tenant_isolation" ON "working_hours"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "branches" b
      WHERE b."id" = "working_hours"."branch_id"
        AND b."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "branches" b
      WHERE b."id" = "working_hours"."branch_id"
        AND b."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  );
ALTER TABLE "working_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "working_hours" FORCE ROW LEVEL SECURITY;

-- branch_date_overrides (via branch)
DROP POLICY IF EXISTS "branch_date_overrides_tenant_isolation" ON "branch_date_overrides";
CREATE POLICY "branch_date_overrides_tenant_isolation" ON "branch_date_overrides"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "branches" b
      WHERE b."id" = "branch_date_overrides"."branch_id"
        AND b."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "branches" b
      WHERE b."id" = "branch_date_overrides"."branch_id"
        AND b."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  );
ALTER TABLE "branch_date_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_date_overrides" FORCE ROW LEVEL SECURITY;

-- branch_services (branch and service must belong to current org)
DROP POLICY IF EXISTS "branch_services_tenant_isolation" ON "branch_services";
CREATE POLICY "branch_services_tenant_isolation" ON "branch_services"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "branches" b
      INNER JOIN "services" s ON s."id" = "branch_services"."service_id"
      WHERE b."id" = "branch_services"."branch_id"
        AND b."org_id" = s."org_id"
        AND b."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "branches" b
      INNER JOIN "services" s ON s."id" = "branch_services"."service_id"
      WHERE b."id" = "branch_services"."branch_id"
        AND b."org_id" = s."org_id"
        AND b."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  );
ALTER TABLE "branch_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_services" FORCE ROW LEVEL SECURITY;

-- sub_services (via service)
DROP POLICY IF EXISTS "sub_services_tenant_isolation" ON "sub_services";
CREATE POLICY "sub_services_tenant_isolation" ON "sub_services"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "services" s
      WHERE s."id" = "sub_services"."service_id"
        AND s."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "services" s
      WHERE s."id" = "sub_services"."service_id"
        AND s."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  );
ALTER TABLE "sub_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sub_services" FORCE ROW LEVEL SECURITY;

-- queue_rules (via queue)
DROP POLICY IF EXISTS "queue_rules_tenant_isolation" ON "queue_rules";
CREATE POLICY "queue_rules_tenant_isolation" ON "queue_rules"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "queues" q
      WHERE q."id" = "queue_rules"."queue_id"
        AND q."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "queues" q
      WHERE q."id" = "queue_rules"."queue_id"
        AND q."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  );
ALTER TABLE "queue_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "queue_rules" FORCE ROW LEVEL SECURITY;
