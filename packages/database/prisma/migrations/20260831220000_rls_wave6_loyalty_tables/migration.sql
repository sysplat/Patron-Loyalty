-- Wave 6 RLS for loyalty LMS tables.
-- Read-path bypass when app.bypass_rls is on (PrismaService.withBypassRls).
-- Write-path requires app.current_org_id.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'loyalty_programs',
    'loyalty_tiers',
    'loyalty_accounts',
    'loyalty_point_ledger',
    'loyalty_rewards',
    'loyalty_redemptions',
    'loyalty_coupons',
    'loyalty_coupon_redemptions',
    'loyalty_wallets',
    'loyalty_wallet_transactions',
    'loyalty_referrals',
    'loyalty_earn_rules',
    'loyalty_campaigns',
    'loyalty_campaign_sends',
    'loyalty_badges',
    'loyalty_challenges',
    'loyalty_gift_cards',
    'loyalty_patron_game_plays',
    'loyalty_pos_connections',
    'loyalty_marketing_connections'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I
        USING (
          current_setting(''app.bypass_rls'', true) = ''on''
          OR org_id = NULLIF(current_setting(''app.current_org_id'', true), '''')::uuid
        )
        WITH CHECK (
          org_id = NULLIF(current_setting(''app.current_org_id'', true), '''')::uuid
        )',
      t || '_tenant_isolation',
      t
    );
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
