-- Deduplicate queue ticket prefixes within each branch before adding the unique constraint.
WITH ranked AS (
  SELECT
    id,
    prefix,
    ROW_NUMBER() OVER (PARTITION BY branch_id, prefix ORDER BY created_at, id) AS rn
  FROM queues
)
UPDATE queues AS q
SET prefix = LEFT(r.prefix, GREATEST(1, 5 - LENGTH(r.rn::text))) || r.rn::text
FROM ranked AS r
WHERE q.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX "queues_branch_id_prefix_key" ON "queues"("branch_id", "prefix");
