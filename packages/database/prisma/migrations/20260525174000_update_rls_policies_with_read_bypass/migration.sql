-- Drop old policies
DROP POLICY IF EXISTS "tickets_tenant_isolation" ON "tickets";
DROP POLICY IF EXISTS "customers_tenant_isolation" ON "customers";

-- Recreate Tickets Policy: USING allows tenant OR bypass; WITH CHECK allows ONLY tenant.
CREATE POLICY "tickets_tenant_isolation" ON "tickets"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );

-- Recreate Customers Policy: USING allows tenant OR bypass; WITH CHECK allows ONLY tenant.
CREATE POLICY "customers_tenant_isolation" ON "customers"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    "org_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
