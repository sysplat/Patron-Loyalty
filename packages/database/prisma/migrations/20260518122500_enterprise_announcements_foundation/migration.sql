-- Enterprise announcements foundation (idempotent for partial/failed deploys).

CREATE TABLE IF NOT EXISTS "platform_announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'info',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_announcements_pkey" PRIMARY KEY ("id")
);


DO $$ BEGIN
    ALTER TABLE "platform_announcements"
    ADD COLUMN "delivery_mode" VARCHAR(20) NOT NULL DEFAULT 'banner';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "platform_announcements"
    ADD COLUMN "dismiss_behavior" VARCHAR(20) NOT NULL DEFAULT 'allowed';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "platform_announcements"
    ADD COLUMN "require_acknowledgment" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "announcements"
    ADD COLUMN "delivery_mode" VARCHAR(20) NOT NULL DEFAULT 'banner';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "announcements"
    ADD COLUMN "dismiss_behavior" VARCHAR(20) NOT NULL DEFAULT 'allowed';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "announcements"
    ADD COLUMN "require_acknowledgment" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "announcements"
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "announcement_user_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "source_type" VARCHAR(20) NOT NULL,
    "announcement_id" UUID NOT NULL,
    "announcement_version" VARCHAR(50) NOT NULL,
    "seen_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcement_user_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "announcement_user_states_user_id_source_type_announcement_id_ann_key"
ON "announcement_user_states"("user_id", "source_type", "announcement_id", "announcement_version");

CREATE INDEX IF NOT EXISTS "announcement_user_states_user_id_org_id_idx"
ON "announcement_user_states"("user_id", "org_id");

CREATE INDEX IF NOT EXISTS "announcement_user_states_source_type_announcement_id_announcement_v_idx"
ON "announcement_user_states"("source_type", "announcement_id", "announcement_version");

DO $$ BEGIN
    ALTER TABLE "announcement_user_states"
    ADD CONSTRAINT "announcement_user_states_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "announcement_user_states"
    ADD CONSTRAINT "announcement_user_states_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
