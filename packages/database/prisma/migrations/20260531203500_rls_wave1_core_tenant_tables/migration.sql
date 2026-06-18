-- Wave 1 RLS rollout for core tenant tables:
-- queues, visits, desks, services, role_assignments.
-- Read-path bypass is allowed only when app.bypass_rls is enabled by PrismaService.withBypassRls.
-- Write-path always requires app.current_org_id tenant context.

-- queues
DROP POLICY IF EXISTS "queues_tenant_isolation" ON "queues";
CREATE POLICY "queues_tenant_isolation" ON "queues"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "queues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "queues" FORCE ROW LEVEL SECURITY;

-- visits
DROP POLICY IF EXISTS "visits_tenant_isolation" ON "visits";
CREATE POLICY "visits_tenant_isolation" ON "visits"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visits" FORCE ROW LEVEL SECURITY;

-- desks
DROP POLICY IF EXISTS "desks_tenant_isolation" ON "desks";
CREATE POLICY "desks_tenant_isolation" ON "desks"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "desks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "desks" FORCE ROW LEVEL SECURITY;

-- services
DROP POLICY IF EXISTS "services_tenant_isolation" ON "services";
CREATE POLICY "services_tenant_isolation" ON "services"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" FORCE ROW LEVEL SECURITY;

-- role_assignments (tenant ownership derived via joined role/user/branch records)
DROP POLICY IF EXISTS "role_assignments_tenant_isolation" ON "role_assignments";
CREATE POLICY "role_assignments_tenant_isolation" ON "role_assignments"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1
      FROM "roles" r
      WHERE r.id = "role_assignments"."role_id"
        AND r.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "roles" r
      WHERE r.id = "role_assignments"."role_id"
        AND r.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
    AND EXISTS (
      SELECT 1
      FROM "users" u
      WHERE u.id = "role_assignments"."user_id"
        AND u.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
    AND (
      "role_assignments"."branch_id" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "branches" b
        WHERE b.id = "role_assignments"."branch_id"
          AND b.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
      )
    )
  );
ALTER TABLE "role_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_assignments" FORCE ROW LEVEL SECURITY;
