ALTER TABLE "branch_flow_steps"
ADD COLUMN IF NOT EXISTS "desk_number" VARCHAR(20);

UPDATE "branch_flow_steps"
SET "desk_number" = CASE
    WHEN "step_index" >= 1 THEN "step_index"::text
    ELSE '1'
END
WHERE "desk_number" IS NULL OR "desk_number" = '';

ALTER TABLE "branch_flow_steps"
ALTER COLUMN "desk_number" SET NOT NULL;
