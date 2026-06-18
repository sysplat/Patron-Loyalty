CREATE TABLE "branch_date_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "open_time" VARCHAR(5),
    "close_time" VARCHAR(5),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "break_start" VARCHAR(5),
    "break_end" VARCHAR(5),
    "note" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_date_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_date_overrides_branch_id_date_key"
    ON "branch_date_overrides"("branch_id", "date");

CREATE INDEX "branch_date_overrides_branch_id_idx"
    ON "branch_date_overrides"("branch_id");

ALTER TABLE "branch_date_overrides"
    ADD CONSTRAINT "branch_date_overrides_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
