-- Wave 2 RLS rollout for tenant communication and audit tables:
-- appointments, notifications, reviews, notification_templates, activity_logs.
-- Read-path bypass is allowed only when app.bypass_rls is enabled by PrismaService.withBypassRls.
-- Write-path always requires app.current_org_id tenant context.

-- appointments
DROP POLICY IF EXISTS "appointments_tenant_isolation" ON "appointments";
CREATE POLICY "appointments_tenant_isolation" ON "appointments"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;

-- notifications
DROP POLICY IF EXISTS "notifications_tenant_isolation" ON "notifications";
CREATE POLICY "notifications_tenant_isolation" ON "notifications"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

-- reviews
DROP POLICY IF EXISTS "reviews_tenant_isolation" ON "reviews";
CREATE POLICY "reviews_tenant_isolation" ON "reviews"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" FORCE ROW LEVEL SECURITY;

-- notification_templates
DROP POLICY IF EXISTS "notification_templates_tenant_isolation" ON "notification_templates";
CREATE POLICY "notification_templates_tenant_isolation" ON "notification_templates"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_templates" FORCE ROW LEVEL SECURITY;

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_tenant_isolation" ON "activity_logs";
CREATE POLICY "activity_logs_tenant_isolation" ON "activity_logs"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_logs" FORCE ROW LEVEL SECURITY;
