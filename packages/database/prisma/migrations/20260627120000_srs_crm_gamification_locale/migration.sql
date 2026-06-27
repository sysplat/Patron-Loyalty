-- SRS: CRM support tickets, sales opportunities, patron mini-games, locale/currency on program

ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "display_currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "default_locale" VARCHAR(10) NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS "crm_support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "assignee_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_sales_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "stage" VARCHAR(30) NOT NULL DEFAULT 'lead',
    "value_cents" INTEGER NOT NULL DEFAULT 0,
    "expected_close_date" DATE,
    "notes" TEXT,
    "assignee_id" UUID,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sales_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "loyalty_patron_game_plays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "game_type" VARCHAR(30) NOT NULL,
    "result_label" VARCHAR(100) NOT NULL,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_patron_game_plays_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_support_tickets_org_id_customer_id_idx" ON "crm_support_tickets"("org_id", "customer_id");
CREATE INDEX IF NOT EXISTS "crm_support_tickets_org_id_status_priority_idx" ON "crm_support_tickets"("org_id", "status", "priority");
CREATE INDEX IF NOT EXISTS "crm_sales_opportunities_org_id_customer_id_idx" ON "crm_sales_opportunities"("org_id", "customer_id");
CREATE INDEX IF NOT EXISTS "crm_sales_opportunities_org_id_stage_idx" ON "crm_sales_opportunities"("org_id", "stage");
CREATE INDEX IF NOT EXISTS "loyalty_patron_game_plays_org_id_account_id_game_type_played_at_idx" ON "loyalty_patron_game_plays"("org_id", "account_id", "game_type", "played_at");

ALTER TABLE "crm_support_tickets" ADD CONSTRAINT "crm_support_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_support_tickets" ADD CONSTRAINT "crm_support_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_support_tickets" ADD CONSTRAINT "crm_support_tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_sales_opportunities" ADD CONSTRAINT "crm_sales_opportunities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_sales_opportunities" ADD CONSTRAINT "crm_sales_opportunities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_sales_opportunities" ADD CONSTRAINT "crm_sales_opportunities_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loyalty_patron_game_plays" ADD CONSTRAINT "loyalty_patron_game_plays_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
