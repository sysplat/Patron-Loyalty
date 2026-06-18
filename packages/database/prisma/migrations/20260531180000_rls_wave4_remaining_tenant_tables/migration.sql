-- Wave 4 RLS rollout for remaining tenant-scoped tables with direct org_id:
-- ops/workbench, integrations, billing, support, audit, and onboarding.
-- Read-path bypass via app.bypass_rls; writes require app.current_org_id.

-- service_categories
DROP POLICY IF EXISTS "service_categories_tenant_isolation" ON "service_categories";
CREATE POLICY "service_categories_tenant_isolation" ON "service_categories"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "service_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_categories" FORCE ROW LEVEL SECURITY;

-- announcements
DROP POLICY IF EXISTS "announcements_tenant_isolation" ON "announcements";
CREATE POLICY "announcements_tenant_isolation" ON "announcements"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" FORCE ROW LEVEL SECURITY;

-- announcement_user_states
DROP POLICY IF EXISTS "announcement_user_states_tenant_isolation" ON "announcement_user_states";
CREATE POLICY "announcement_user_states_tenant_isolation" ON "announcement_user_states"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "announcement_user_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcement_user_states" FORCE ROW LEVEL SECURITY;

-- station_profiles
DROP POLICY IF EXISTS "station_profiles_tenant_isolation" ON "station_profiles";
CREATE POLICY "station_profiles_tenant_isolation" ON "station_profiles"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "station_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "station_profiles" FORCE ROW LEVEL SECURITY;

-- station_profile_queues
DROP POLICY IF EXISTS "station_profile_queues_tenant_isolation" ON "station_profile_queues";
CREATE POLICY "station_profile_queues_tenant_isolation" ON "station_profile_queues"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "station_profile_queues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "station_profile_queues" FORCE ROW LEVEL SECURITY;

-- agent_sessions
DROP POLICY IF EXISTS "agent_sessions_tenant_isolation" ON "agent_sessions";
CREATE POLICY "agent_sessions_tenant_isolation" ON "agent_sessions"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "agent_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_sessions" FORCE ROW LEVEL SECURITY;

-- branch_flow_templates
DROP POLICY IF EXISTS "branch_flow_templates_tenant_isolation" ON "branch_flow_templates";
CREATE POLICY "branch_flow_templates_tenant_isolation" ON "branch_flow_templates"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "branch_flow_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_flow_templates" FORCE ROW LEVEL SECURITY;

-- branch_flow_steps
DROP POLICY IF EXISTS "branch_flow_steps_tenant_isolation" ON "branch_flow_steps";
CREATE POLICY "branch_flow_steps_tenant_isolation" ON "branch_flow_steps"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "branch_flow_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_flow_steps" FORCE ROW LEVEL SECURITY;

-- display_themes
DROP POLICY IF EXISTS "display_themes_tenant_isolation" ON "display_themes";
CREATE POLICY "display_themes_tenant_isolation" ON "display_themes"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "display_themes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "display_themes" FORCE ROW LEVEL SECURITY;

-- integrations
DROP POLICY IF EXISTS "integrations_tenant_isolation" ON "integrations";
CREATE POLICY "integrations_tenant_isolation" ON "integrations"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integrations" FORCE ROW LEVEL SECURITY;

-- webhook_endpoints
DROP POLICY IF EXISTS "webhook_endpoints_tenant_isolation" ON "webhook_endpoints";
CREATE POLICY "webhook_endpoints_tenant_isolation" ON "webhook_endpoints"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_endpoints" FORCE ROW LEVEL SECURITY;

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON "audit_logs";
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

-- support_requests
DROP POLICY IF EXISTS "support_requests_tenant_isolation" ON "support_requests";
CREATE POLICY "support_requests_tenant_isolation" ON "support_requests"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "support_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_requests" FORCE ROW LEVEL SECURITY;

-- support_messages
DROP POLICY IF EXISTS "support_messages_tenant_isolation" ON "support_messages";
CREATE POLICY "support_messages_tenant_isolation" ON "support_messages"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "support_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_messages" FORCE ROW LEVEL SECURITY;

-- subscriptions
DROP POLICY IF EXISTS "subscriptions_tenant_isolation" ON "subscriptions";
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;

-- invoices
DROP POLICY IF EXISTS "invoices_tenant_isolation" ON "invoices";
CREATE POLICY "invoices_tenant_isolation" ON "invoices"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;

-- payment_records (org scope via parent invoice — no direct org_id column)
DROP POLICY IF EXISTS "payment_records_tenant_isolation" ON "payment_records";
CREATE POLICY "payment_records_tenant_isolation" ON "payment_records"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "invoices" i
      WHERE i."id" = "payment_records"."invoice_id"
        AND i."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "invoices" i
      WHERE i."id" = "payment_records"."invoice_id"
        AND i."org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
  );
ALTER TABLE "payment_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_records" FORCE ROW LEVEL SECURITY;

-- sms_credit_purchases
DROP POLICY IF EXISTS "sms_credit_purchases_tenant_isolation" ON "sms_credit_purchases";
CREATE POLICY "sms_credit_purchases_tenant_isolation" ON "sms_credit_purchases"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "sms_credit_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_credit_purchases" FORCE ROW LEVEL SECURITY;

-- org_health_snapshots
DROP POLICY IF EXISTS "org_health_snapshots_tenant_isolation" ON "org_health_snapshots";
CREATE POLICY "org_health_snapshots_tenant_isolation" ON "org_health_snapshots"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "org_health_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_health_snapshots" FORCE ROW LEVEL SECURITY;

-- file_uploads
DROP POLICY IF EXISTS "file_uploads_tenant_isolation" ON "file_uploads";
CREATE POLICY "file_uploads_tenant_isolation" ON "file_uploads"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "file_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_uploads" FORCE ROW LEVEL SECURITY;

-- onboarding_progress
DROP POLICY IF EXISTS "onboarding_progress_tenant_isolation" ON "onboarding_progress";
CREATE POLICY "onboarding_progress_tenant_isolation" ON "onboarding_progress"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
ALTER TABLE "onboarding_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_progress" FORCE ROW LEVEL SECURITY;
