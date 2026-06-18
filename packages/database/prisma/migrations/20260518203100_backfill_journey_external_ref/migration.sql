-- Backfill journey external_ref columns (runs after 20260518203000 adds the columns).

-- Visit-level ref from the newest ticket in each visit that already stores one.
UPDATE "visits" v
SET "external_ref" = sub.ref
FROM (
    SELECT DISTINCT ON (t.visit_id)
        t.visit_id,
        btrim(t.external_ref) AS ref
    FROM "tickets" t
    WHERE t.visit_id IS NOT NULL
      AND t.external_ref IS NOT NULL
      AND btrim(t.external_ref) <> ''
    ORDER BY t.visit_id, t.booked_at DESC
) sub
WHERE v.id = sub.visit_id
  AND (v.external_ref IS NULL OR btrim(v.external_ref) = '');

-- Propagate visit ref onto terminal journey tickets that are still missing one.
UPDATE "tickets" t
SET "external_ref" = v.external_ref
FROM "visits" v
WHERE t.visit_id = v.id
  AND t.status IN ('completed', 'no_show')
  AND (t.external_ref IS NULL OR btrim(t.external_ref) = '')
  AND v.external_ref IS NOT NULL
  AND btrim(v.external_ref) <> '';

UPDATE "tickets" t
SET "external_ref" = sub.ref
FROM (
    SELECT DISTINCT ON (t.visit_id)
        t.visit_id,
        btrim(t.external_ref) AS ref
    FROM "tickets" t
    WHERE t.visit_id IS NOT NULL
      AND t.external_ref IS NOT NULL
      AND btrim(t.external_ref) <> ''
    ORDER BY t.visit_id, t.booked_at DESC
) sub
WHERE t.visit_id = sub.visit_id
  AND t.status IN ('completed', 'no_show')
  AND (t.external_ref IS NULL OR btrim(t.external_ref) = '');
