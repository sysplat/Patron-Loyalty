-- Wave 3 RLS rollout for org structure and identity tables:
-- branches, roles, settings, display_devices, users.
-- Read-path bypass is allowed only when app.bypass_rls is enabled by PrismaService.withBypassRls.
-- Write-path always requires app.current_org_id tenant context.

-- branches
DROP POLICY IF EXISTS "branches_tenant_isolation" ON "branches";
CREATE POLICY "branches_tenant_isolation" ON "branches"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;

-- roles
DROP POLICY IF EXISTS "roles_tenant_isolation" ON "roles";
CREATE POLICY "roles_tenant_isolation" ON "roles"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;

-- settings
DROP POLICY IF EXISTS "settings_tenant_isolation" ON "settings";
CREATE POLICY "settings_tenant_isolation" ON "settings"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" FORCE ROW LEVEL SECURITY;

-- display_devices
DROP POLICY IF EXISTS "display_devices_tenant_isolation" ON "display_devices";
CREATE POLICY "display_devices_tenant_isolation" ON "display_devices"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "display_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "display_devices" FORCE ROW LEVEL SECURITY;

-- users
DROP POLICY IF EXISTS "users_tenant_isolation" ON "users";
CREATE POLICY "users_tenant_isolation" ON "users"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
